/**
 * End-to-end test for the live voice room service (voice-service :3004)
 * via the Caddy gateway (same path as the user preview).
 *
 * Wire protocol under test ("voice:frame", top-level binary):
 *   [4B sessionId BE][4B seq BE][1B flags] + payload, flags bit1 = header
 *
 * Simulates: host (admin token) + 2 listeners + 1 late joiner,
 * full mic handoff flow with binary audio chunks.
 * Run: bun scripts/voice-test.ts
 */
import { io, type Socket } from "socket.io-client";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "coocoo-radio-secret-2026";
const URL_BASE = "http://localhost:81";
const OPTS = {
  path: "/",
  transports: ["websocket", "polling"],
  timeout: 8000,
} as const;

// --- helpers ---
let failed = false;
function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
  } else {
    failed = true;
    console.error(`  ❌ ${msg}`);
  }
}

interface ParsedFrame {
  sessionId: number;
  seq: number;
  flags: number;
  text: string;
}

function parseFrame(d: unknown): ParsedFrame | null {
  const u8 =
    d instanceof Uint8Array
      ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
      : d instanceof ArrayBuffer
        ? new Uint8Array(d)
        : null;
  if (!u8 || u8.byteLength < 10) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  return {
    sessionId: dv.getUint32(0),
    seq: dv.getUint32(4),
    flags: dv.getUint8(8),
    text: new TextDecoder().decode(u8.subarray(9)),
  };
}

const connect = (): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const s = io(`${URL_BASE}/?XTransformPort=3004`, OPTS);
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e: Error) => reject(e));
    setTimeout(() => reject(new Error("connect timeout")), 10000);
  });

const waitFor = <T,>(socket: Socket, event: string, pred?: (d: T) => boolean, ms = 6000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, h);
      reject(new Error(`timeout waiting "${event}"`));
    }, ms);
    const h = (d: T) => {
      if (!pred || pred(d)) {
        clearTimeout(timer);
        socket.off(event, h);
        resolve(d);
      }
    };
    socket.on(event, h);
  });

const waitForFrame = (socket: Socket, pred: (f: ParsedFrame) => boolean, ms = 6000): Promise<ParsedFrame> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.offAny(h);
      reject(new Error(`timeout waiting frame`));
    }, ms);
    const h = (ev: unknown, ...args: unknown[]) => {
      if (ev !== "voice:frame") return;
      const f = parseFrame(args[0]);
      if (f && pred(f)) {
        clearTimeout(timer);
        socket.offAny(h);
        resolve(f);
      }
    };
    socket.onAny(h);
  });

const emitAck = (socket: Socket, event: string, data: unknown): Promise<{ ok: boolean; seq: number }> =>
  new Promise((resolve) => socket.emit(event, data, (r: { ok: boolean; seq: number }) => resolve(r)));

const bytes = (s: string): ArrayBuffer => {
  const u = new TextEncoder().encode(s);
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
};

const makeAdminToken = (): string => {
  const payload = `admin|${Date.now()}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
};

// --- test ---
async function main() {
  const token = makeAdminToken();

  console.log("▶ connecting clients…");
  const host = await connect();
  const A = await connect();
  const B = await connect();
  console.log(`  ids: host=${host.id} A=${A.id} B=${B.id}`);

  // 1. bad token rejected
  console.log("▶ host:start with BAD token");
  host.emit("host:start", { token: "garbage" });
  const err1 = await waitFor<{ error: string }>(host, "voice:error");
  assert(/admin/.test(err1.error), `bad token rejected: "${err1.error}"`);

  // 2. join
  console.log("▶ joins");
  host.emit("voice:join", { name: "RJ Host", token });
  A.emit("voice:join", { name: "Simran" });
  B.emit("voice:join", { name: "Amar" });
  const st3 = await waitFor<Record<string, unknown>>(host, "voice:state", (d) => d.members.length === 3);
  assert(st3.members.length === 3, "3 members in room");
  const hostMember = (st3.members as { id: string; isAdmin: boolean }[]).find((m) => m.id === host.id);
  assert(hostMember?.isAdmin === true, "host flagged as admin via token");

  // 3. start room
  console.log("▶ host:start (real token)");
  host.emit("host:start", { token });
  const st4 = await waitFor<{ active: boolean }>(host, "voice:state", (d) => d.active);
  assert(st4.active === true, "room is active");

  // 4. claim mic
  host.emit("host:claim", { token });
  const st5 = await waitFor<{ speakerId: string | null }>(host, "voice:state", (d) => !!d.speakerId);
  assert(st5.speakerId === host.id, "host has the mic");

  // 5. header chunk -> listeners get framed header (top-level binary)
  console.log("▶ host streams audio");
  const sessA = waitForFrame(A, (f) => (f.flags & 1) === 1);
  const sessB = waitForFrame(B, (f) => (f.flags & 1) === 1);
  const ackH = await emitAck(host, "voice:chunk", bytes("WEBM-HEADER"));
  assert(ackH.ok && ackH.seq === 0, "host header chunk acked with seq=0");
  const sa = await sessA;
  const sb = await sessB;
  assert(sa.text === "WEBM-HEADER", `A got framed header: "${sa.text}" (session ${sa.sessionId})`);
  assert(sb.text === "WEBM-HEADER", "B got framed header");

  // 6. data chunks relayed with proper seq (attach listeners BEFORE emitting — relay happens before ack)
  const f1A = waitForFrame(A, (f) => f.text === "chunk-1");
  await emitAck(host, "voice:chunk", bytes("chunk-1"));
  const cc1 = await f1A;
  assert(cc1.seq === 1 && cc1.sessionId === sa.sessionId, "A got chunk seq=1 same session");
  const f2B = waitForFrame(B, (f) => f.text === "chunk-2");
  await emitAck(host, "voice:chunk", bytes("chunk-2"));
  const cc2 = await f2B;
  assert(cc2.seq === 2, "B got chunk seq=2");

  // host must NOT hear itself
  let echoed = false;
  const echoHandler = () => (echoed = true);
  host.onAny(echoHandler);
  await emitAck(host, "voice:chunk", bytes("chunk-3"));
  await new Promise((r) => setTimeout(r, 400));
  host.offAny(echoHandler);
  assert(!echoed, "host does not receive its own audio (no echo)");

  // 7. late joiner catch-up: header frame + backlog in order
  console.log("▶ late joiner C");
  const C = await connect();
  const cFrames: ParsedFrame[] = [];
  const catchup = waitForFrame(C, (f) => f.text === "chunk-3").then(() => cFrames);
  C.onAny((ev, ...args) => {
    if (ev !== "voice:frame") return;
    const f = parseFrame(args[0]);
    if (f) cFrames.push(f);
  });
  C.emit("voice:join", { name: "Late Jas" });
  await catchup;
  assert(cFrames[0]?.text === "WEBM-HEADER" && (cFrames[0].flags & 1) === 1, "C catch-up starts with header frame");
  assert(cFrames.length === 4, `C got ${cFrames.length} frames (header + 3 backlog)`);
  const seqs = cFrames.map((f) => f.seq);
  assert(seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1), `C frames in order: [${seqs.join(",")}]`);

  // 8. raise hand -> queue
  console.log("▶ mic handoff to A");
  A.emit("voice:raise");
  const st6 = await waitFor<{ queue: string[] }>(host, "voice:state", (d) => d.queue.includes(A.id));
  assert(st6.queue.includes(A.id), "A in mic queue");

  // 9. grant mic to A
  host.emit("host:grant", { token, memberId: A.id });
  const st7 = await waitFor<{ speakerId: string | null; sessionId: number }>(
    B,
    "voice:state",
    (d) => d.speakerId === A.id
  );
  assert(st7.speakerId === A.id, "A now the speaker");

  // 10. A streams -> host + B get NEW session header
  const sessH2 = waitForFrame(host, (f) => f.text === "A-HEADER" && (f.flags & 1) === 1);
  const talkBack = waitForFrame(host, (f) => f.text === "A-talk");
  await emitAck(A, "voice:chunk", bytes("A-HEADER"));
  const s2 = await sessH2;
  assert(s2.sessionId > sa.sessionId, `new session id ${s2.sessionId} > ${sa.sessionId}`);
  await emitAck(A, "voice:chunk", bytes("A-talk"));
  const ca = await talkBack;
  assert(ca.seq === 1, "host hears A's voice, seq continues in new session");

  // 11. end speaker
  host.emit("host:endSpeaker", { token });
  await waitFor<{ speakerId: string | null }>(A, "voice:state", (d) => d.speakerId === null);
  assert(true, "speaker released by host");

  // 12. non-admin cannot grant
  console.log("▶ security checks");
  A.emit("host:grant", { token: "fake", memberId: B.id });
  const err2 = await waitFor<{ error: string }>(A, "voice:error");
  assert(/admin/.test(err2.error), "non-admin grant rejected");

  // 13. claim back + stop
  host.emit("host:claim", { token });
  await waitFor<{ speakerId: string | null }>(host, "voice:state", (d) => d.speakerId === host.id);
  host.emit("host:stop", { token });
  const st8 = await waitFor<{ active: boolean }>(B, "voice:state", (d) => !d.active);
  assert(st8.active === false, "room stopped");

  // 14. disconnect cleanup
  const st9 = waitFor<Record<string, unknown>>(host, "voice:state", (d) => d.members.length === 3);
  B.disconnect();
  await st9;
  assert(true, "B disconnect removed from members");

  [host, A, C].forEach((s) => s.disconnect());
  setTimeout(() => {
    console.log(failed ? "\n❌ TEST FAILED" : "\n🎉 ALL VOICE TESTS PASSED");
    process.exit(failed ? 1 : 0);
  }, 300);
}

main().catch((e) => {
  console.error("❌ test crashed:", e.message);
  process.exit(1);
});
