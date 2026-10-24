/**
 * CooCoo Radio — Live Voice Room Service (socket.io)
 * Port 3004. Frontend connects via io("/?XTransformPort=3004", { path: "/" }).
 *
 * Live podcast / discussion room (Clubhouse style):
 * - Admin (host) starts the room and takes the mic first
 * - Listeners join, raise hand, host grants the mic — one speaker at a time
 * - Speaker streams raw webm/opus chunks (MediaRecorder); service relays them
 *   to everyone else as TOP-LEVEL BINARY frames so the browser gets real
 *   ArrayBuffer/Uint8Data (bun's socket.io mangles binary nested in objects!)
 *
 * Wire protocol for audio ("voice:frame" event, single Buffer argument):
 *   [4B sessionId BE][4B seq BE][1B flags] + payload
 *   flags bit 0x01 = payload is the session header (webm EBML header)
 * Late joiners get: header frame + last RING data frames (catch-up), then live.
 *
 * Admin auth = same HMAC token as the main app (src/lib/auth.ts).
 */
import { createServer } from "http";
import crypto from "crypto";
import { Server, type Socket } from "socket.io";

const PORT = 3004;
const SECRET = process.env.AUTH_SECRET || "coocoo-radio-secret-2026";
const MAX_MEMBERS = 60;
const MAX_CHUNK = 200 * 1024; // 200KB per audio chunk
const RING = 10; // recent data frames kept for late joiners (~10s)

// --- admin token verify (mirror of src/lib/auth.ts verifyToken) ---
function verifyAdmin(token: unknown): string | null {
  if (typeof token !== "string" || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  let payload: string;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString();
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const parts = payload.split("|");
  const ts = Number(parts[1]);
  if (!ts || Date.now() - ts > 30 * 24 * 3600 * 1000) return null;
  return parts[0];
}

interface Member {
  id: string;
  name: string;
  isAdmin: boolean;
  raised: boolean;
  joinedAt: number;
}

const HEADER_FLAG = 0x01;

function toBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  if (data instanceof Uint8Array) return Buffer.from(data);
  return null;
}

function frame(sessionId: number, seq: number, flags: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(9);
  head.writeUInt32BE(sessionId >>> 0, 0);
  head.writeUInt32BE(seq >>> 0, 4);
  head.writeUInt8(flags, 8);
  return Buffer.concat([head, payload]);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
});

// --- room state (in-memory) ---
let active = false;
let startedAt: number | null = null;
let hostName: string | null = null;
let speakerId: string | null = null;
let sessionId = 0;
let headerFrame: Buffer | null = null; // framed header of the current speaker session
let lastSeq = 0;
const ring: { seq: number; frame: Buffer }[] = [];
const members = new Map<string, Member>();
const queue: string[] = [];

const sanitize = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);

function publicState() {
  return {
    active,
    startedAt,
    hostName,
    speakerId,
    speakerName: speakerId ? members.get(speakerId)?.name ?? null : null,
    sessionId,
    members: Array.from(members.values()).map((m) => ({
      id: m.id,
      name: m.name,
      isAdmin: m.isAdmin,
      raised: m.raised,
    })),
    queue: [...queue],
  };
}

function broadcastState() {
  io.emit("voice:state", publicState());
}

function clearQueue(id: string) {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
}

function setSpeaker(socket: Socket) {
  speakerId = socket.id;
  sessionId += 1;
  headerFrame = null;
  lastSeq = 0;
  ring.length = 0;
  const m = members.get(socket.id);
  if (m) m.raised = false;
  clearQueue(socket.id);
  broadcastState();
}

function releaseSpeaker() {
  if (!speakerId) return;
  speakerId = null;
  headerFrame = null;
  ring.length = 0;
  broadcastState();
}

io.on("connection", (socket: Socket) => {
  socket.on("voice:join", (data: { name?: string; token?: string }) => {
    if (members.has(socket.id)) return;
    if (members.size >= MAX_MEMBERS) {
      socket.emit("voice:error", { error: "Room full hai, thodi der baad koshish karo" });
      return;
    }
    const name = sanitize(data?.name, 24) || "Sarota";
    const admin = verifyAdmin(data?.token);
    members.set(socket.id, {
      id: socket.id,
      name,
      isAdmin: !!admin,
      raised: false,
      joinedAt: Date.now(),
    });
    // late joiner catch-up: header frame first, then recent data frames
    if (active && speakerId) {
      if (headerFrame) socket.emit("voice:frame", headerFrame);
      for (const f of ring) socket.emit("voice:frame", f.frame);
    }
    socket.emit("voice:joined", { id: socket.id });
    broadcastState();
    console.log(`[join] ${name}${admin ? " (admin)" : ""} — members: ${members.size}`);
  });

  socket.on("voice:raise", () => {
    const m = members.get(socket.id);
    if (!m || !active || speakerId === socket.id) return;
    if (!m.raised) {
      m.raised = true;
      if (!queue.includes(socket.id)) queue.push(socket.id);
      broadcastState();
    }
  });

  socket.on("voice:unraise", () => {
    const m = members.get(socket.id);
    if (!m) return;
    m.raised = false;
    clearQueue(socket.id);
    broadcastState();
  });

  socket.on("voice:release", () => {
    // current speaker steps down voluntarily
    if (active && speakerId === socket.id) releaseSpeaker();
  });

  // --- host controls (admin only) ---
  socket.on("host:start", (data: { token?: string }) => {
    const admin = verifyAdmin(data?.token);
    if (!admin) {
      socket.emit("voice:error", { error: "Sirf admin hi live room start kar sakda hai" });
      return;
    }
    active = true;
    startedAt = Date.now();
    hostName = admin;
    speakerId = null;
    sessionId = 0;
    headerFrame = null;
    ring.length = 0;
    broadcastState();
    console.log(`[host] live room started by ${admin}`);
  });

  socket.on("host:stop", (data: { token?: string }) => {
    const admin = verifyAdmin(data?.token);
    if (!admin) {
      socket.emit("voice:error", { error: "Sirf admin hi room band kar sakda hai" });
      return;
    }
    active = false;
    startedAt = null;
    hostName = null;
    speakerId = null;
    headerFrame = null;
    ring.length = 0;
    queue.length = 0;
    members.forEach((m) => (m.raised = false));
    broadcastState();
    console.log(`[host] live room stopped by ${admin}`);
  });

  socket.on("host:claim", (data: { token?: string }) => {
    const admin = verifyAdmin(data?.token);
    if (!admin) {
      socket.emit("voice:error", { error: "Sirf admin hi mic le sakda hai" });
      return;
    }
    if (!active) {
      socket.emit("voice:error", { error: "Pehla live room START karo" });
      return;
    }
    if (!members.has(socket.id)) {
      socket.emit("voice:error", { error: "Pehla studio vich join karo" });
      return;
    }
    setSpeaker(socket);
    console.log(`[mic] admin ${admin} took the mic`);
  });

  socket.on("host:grant", (data: { token?: string; memberId?: string }) => {
    const admin = verifyAdmin(data?.token);
    if (!admin) {
      socket.emit("voice:error", { error: "Sirf admin hi mic de sakda hai" });
      return;
    }
    const target = data?.memberId ? members.get(data.memberId) : undefined;
    const targetSocket = data?.memberId ? io.of("/").sockets.get(data.memberId) : undefined;
    if (!target || !targetSocket) {
      socket.emit("voice:error", { error: "Eh member hun room vich nahi hai" });
      return;
    }
    setSpeaker(targetSocket as Socket);
    console.log(`[mic] granted to ${target.name}`);
  });

  socket.on("host:endSpeaker", (data: { token?: string }) => {
    const admin = verifyAdmin(data?.token);
    if (!admin) {
      socket.emit("voice:error", { error: "Sirf admin hi speaker band kar sakda hai" });
      return;
    }
    releaseSpeaker();
    console.log(`[mic] speaker ended by ${admin}`);
  });

  // --- audio relay (only the current speaker may emit) ---
  socket.on("voice:chunk", (data: unknown, ack?: (r: { ok: boolean; seq: number }) => void) => {
    if (!active || speakerId !== socket.id) return; // not the speaker -> ignore
    const payload = toBuffer(data);
    if (!payload || !payload.length || payload.length > MAX_CHUNK) return;
    let seq: number;
    let flags = 0;
    let f: Buffer;
    if (!headerFrame) {
      // first chunk of the session carries the webm/EBML header
      seq = 0;
      flags = HEADER_FLAG;
      f = frame(sessionId, seq, flags, payload);
      headerFrame = f;
    } else {
      lastSeq += 1;
      seq = lastSeq;
      f = frame(sessionId, seq, flags, payload);
      ring.push({ seq, frame: f });
      if (ring.length > RING) ring.splice(0, ring.length - RING);
    }
    socket.broadcast.emit("voice:frame", f);
    ack?.({ ok: true, seq });
  });

  socket.on("disconnect", () => {
    const m = members.get(socket.id);
    if (!m) return;
    members.delete(socket.id);
    clearQueue(socket.id);
    if (speakerId === socket.id) releaseSpeaker();
    broadcastState();
    console.log(`[left] ${m.name} — members: ${members.size}`);
  });

  socket.on("error", (err) => {
    console.error(`[socket-error] ${socket.id}:`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎙️ CooCoo live voice service running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
