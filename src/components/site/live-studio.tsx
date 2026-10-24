"use client";

/**
 * CooCoo Radio — Live Studio (voice room)
 * Live podcast / discussion room:
 * - Listener: join by name, hear the current speaker (MSE webm/opus playback),
 *   raise hand to ask for the mic
 * - Speaker (when admin grants you the mic): mic streams via MediaRecorder
 * - Admin (host console): start/end room, take mic, grant mic to raised hands
 * Transport: socket.io mini-service voice-service (:3004) via Caddy gateway.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  AudioLines,
  Crown,
  Hand,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  PowerOff,
  Radio,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/site/schedule";
import { getToken } from "@/lib/client-auth";

interface LiveMember {
  id: string;
  name: string;
  isAdmin: boolean;
  raised: boolean;
}

interface LiveState {
  active: boolean;
  startedAt: number | null;
  hostName: string | null;
  speakerId: string | null;
  speakerName: string | null;
  sessionId: number;
  members: LiveMember[];
  queue: string[];
}

interface MseHandle {
  mse: MediaSource;
  sb: SourceBuffer | null;
  url: string;
  session: number;
}

/**
 * Audio wire frame: [4B sessionId BE][4B seq BE][1B flags] + payload
 * flags bit 0x01 = payload is the webm/EBML session header.
 */
const FRAME_HEADER = 9;
const FLAG_HEADER = 0x01;

const NAME_KEY = "coocoo_live_name";

/**
 * Socket URL strategy (same as live-chat):
 * - preview/sandbox gateway -> XTransformPort query routes to voice-service
 * - local run on :3000 (no gateway) -> connect straight to the service port
 * - serverless (Netlify) -> gateway path fails, wsDown notice is shown
 */
function voiceSocketUrl(): string {
  if (typeof window === "undefined") return "/?XTransformPort=3004";
  const host = window.location.hostname;
  const isLocalDev =
    (host === "localhost" || host === "127.0.0.1") && window.location.port === "3000";
  return isLocalDev ? "http://localhost:3004" : "/?XTransformPort=3004";
}

const ADMIN_EVENT = "coocoo:admin-changed";

export default function LiveStudio() {
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mseRef = useRef<MseHandle | null>(null);
  const pendingRef = useRef<ArrayBuffer[]>([]);
  const lastSeqRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
  const nameRef = useRef("");

  const [state, setState] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [volume, setVolume] = useState(90);
  const [err, setErr] = useState("");
  const [micErr, setMicErr] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [mseOk, setMseOk] = useState(true);
  const [recOk, setRecOk] = useState(true);
  const [wsDown, setWsDown] = useState(false);

  const st = state;
  const imSpeaker = !!myId && st?.active && st.speakerId === myId;

  /* ---------- playback (MSE) ---------- */

  const teardownPlayback = useCallback(() => {
    pendingRef.current = [];
    const p = mseRef.current;
    mseRef.current = null;
    if (p) {
      try {
        if (p.mse.readyState === "open") p.mse.endOfStream();
      } catch {
        /* ignore */
      }
      URL.revokeObjectURL(p.url);
    }
  }, []);

  const pump = useCallback(() => {
    const p = mseRef.current;
    if (!p || !p.sb || p.sb.updating) return;
    const next = pendingRef.current.shift();
    if (!next) return;
    try {
      p.sb.appendBuffer(next);
    } catch {
      /* buffer error -> session will be rebuilt on next voice:session */
    }
  }, []);

  const startPlaybackSession = useCallback(
    (sessionId: number, headerBytes: Uint8Array) => {
      const audio = audioRef.current;
      if (!audio || !mseOk) return;
      teardownPlayback();
      lastSeqRef.current = 0;

      const mse = new MediaSource();
      const url = URL.createObjectURL(mse);
      mseRef.current = { mse, sb: null, url, session: sessionId };

      mse.addEventListener(
        "sourceopen",
        () => {
          const p = mseRef.current;
          if (!p || p.session !== sessionId) return;
          let sb: SourceBuffer;
          try {
            sb = mse.addSourceBuffer('audio/webm; codecs="opus"');
          } catch {
            setMseOk(false);
            return;
          }
          p.sb = sb;
          try {
            sb.mode = "sequence";
          } catch {
            /* some browsers may not allow switching mode */
          }
          sb.addEventListener("updateend", pump);
          pendingRef.current = [headerBytes];
          pump();
          audio.play().catch(() => {});
        },
        { once: true }
      );
      audio.src = url;
      audio.play().catch(() => {});
    },
    [mseOk, pump, teardownPlayback]
  );

  /** binary audio frame from the voice service */
  const handleFrame = useCallback(
    (d: ArrayBuffer | Uint8Array) => {
      const u8 = d instanceof Uint8Array ? new Uint8Array(d) : new Uint8Array(d);
      if (u8.byteLength < FRAME_HEADER + 1) return;
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const sid = dv.getUint32(0);
      const seq = dv.getUint32(4);
      const flags = dv.getUint8(8);
      const payload = u8.subarray(FRAME_HEADER);
      if (flags & FLAG_HEADER) {
        // new speaker session -> rebuild playback around this header
        startPlaybackSession(sid, payload);
        return;
      }
      const p = mseRef.current;
      if (!p || sid !== p.session) return; // stale or unknown session
      if (seq <= lastSeqRef.current) return; // duplicate / out of order
      lastSeqRef.current = seq;
      pendingRef.current.push(payload);
      pump();
    },
    [pump, startPlaybackSession]
  );

  // trim old buffered audio so long sessions don't grow memory
  useEffect(() => {
    if (!joined) return;
    const t = window.setInterval(() => {
      const p = mseRef.current;
      const audio = audioRef.current;
      if (!p || !p.sb || p.sb.updating || !audio) return;
      try {
        if (p.mse.readyState === "open" && p.sb.buffered.length >= 1) {
          const start = p.sb.buffered.start(0);
          const cut = audio.currentTime - 15;
          if (cut > start + 2) p.sb.remove(start, cut);
        }
      } catch {
        /* ignore */
      }
    }, 30000);
    return () => window.clearInterval(t);
  }, [joined]);

  /* ---------- speaking (MediaRecorder) ---------- */

  const stopSpeaking = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec) {
      rec.ondataavailable = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    setSpeaking(false);
  }, []);

  const startSpeaking = useCallback(async () => {
    if (recorderRef.current) return;
    setMicErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          // raw binary chunk (top-level) — service wraps it with seq/session header
          e.data
            .arrayBuffer()
            .then((b) => socketRef.current?.emit("voice:chunk", b))
            .catch(() => {});
        }
      };
      rec.onerror = () => stopSpeaking();
      rec.start(1000);
      recorderRef.current = rec;
      setSpeaking(true);
    } catch {
      // mic denied / unavailable -> give the mic back
      socketRef.current?.emit("voice:release");
      setMicErr("Mic permission nahi mili — browser vich mic allow karo te dobara try karo");
    }
  }, [stopSpeaking]);

  // auto start/stop mic streaming when I become / stop being the speaker
  useEffect(() => {
    if (imSpeaker) {
      void startSpeaking();
    } else {
      stopSpeaking();
    }
  }, [imSpeaker, startSpeaking, stopSpeaking]);

  /* ---------- socket ---------- */

  useEffect(() => {
    const s = io(voiceSocketUrl(), {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    });
    socketRef.current = s;

    // serverless hosting (Netlify) can't run the voice WebSocket mini-service —
    // if we can't connect within 6s, show a friendly notice
    const wsFailTimer = window.setTimeout(() => {
      if (!s.connected) setWsDown(true);
    }, 6000);

    s.on("connect", () => {
      window.clearTimeout(wsFailTimer);
      setWsDown(false);
      setConnected(true);
      setMyId(s.id ?? null);
      setErr("");
      // re-join after reconnect so presence stays alive
      if (joinedRef.current) {
        s.emit("voice:join", { name: nameRef.current, token: getToken() ?? undefined });
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));

    s.on("voice:state", (d: LiveState) => {
      if (d && Array.isArray(d.members)) setState(d);
    });
    s.on("voice:frame", (d: ArrayBuffer | Uint8Array) => handleFrame(d));
    s.on("voice:error", (d: { error?: string }) => setErr(d?.error || "Koi error aaya"));

    return () => {
      window.clearTimeout(wsFailTimer);
      s.disconnect();
      socketRef.current = null;
    };
  }, [handleFrame]);

  // cleanup media on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      teardownPlayback();
    };
  }, [stopSpeaking, teardownPlayback]);

  /* ---------- support + name + admin detection ---------- */

  useEffect(() => {
    const mseSupported =
      typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('audio/webm; codecs="opus"');
    setMseOk(mseSupported);
    setRecOk(
      typeof MediaRecorder !== "undefined" &&
        (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ||
          MediaRecorder.isTypeSupported("audio/webm"))
    );
    const t = setTimeout(() => {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) {
        setName(saved);
        nameRef.current = saved;
      }
      setIsAdmin(!!getToken());
    }, 0);
    const onAdmin = () => setIsAdmin(!!getToken());
    window.addEventListener(ADMIN_EVENT, onAdmin);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(ADMIN_EVENT, onAdmin);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  /* ---------- actions ---------- */

  const emitJoin = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    s.emit("voice:join", { name: nameRef.current, token: getToken() ?? undefined });
  }, []);

  const join = useCallback(() => {
    const n = name.trim() || "Sarota";
    nameRef.current = n;
    joinedRef.current = true;
    window.localStorage.setItem(NAME_KEY, n);
    emitJoin();
    setJoined(true);
    setErr("");
    audioRef.current?.play().catch(() => {});
  }, [name, emitJoin]);

  const hostAction = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const token = getToken();
    if (!token) {
      setErr("Eh action sirf admin layi hai — pehla admin panel vich login karo");
      return;
    }
    socketRef.current?.emit(event, { token, ...extra });
    setErr("");
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit("voice:release");
    socketRef.current?.emit("voice:unraise");
    joinedRef.current = false;
    setJoined(false);
    stopSpeaking();
    teardownPlayback();
  }, [stopSpeaking, teardownPlayback]);

  /* ---------- derived ---------- */

  const members = st?.members ?? [];
  const onlineCount = members.length;
  const liveSeconds = st?.startedAt ? Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000)) : 0;
  const liveLabel =
    liveSeconds > 0
      ? `${Math.floor(liveSeconds / 3600)}:${String(Math.floor((liveSeconds % 3600) / 60)).padStart(2, "0")}:${String(liveSeconds % 60).padStart(2, "0")}`
      : null;
  const iAmInQueue = !!myId && st?.queue.includes(myId);

  /* ---------- render ---------- */

  return (
    <section
      id="live"
      className={`border-b border-amber-400/10 transition-colors ${
        st?.active ? "bg-[oklch(0.185_0.03_30)]" : "bg-[oklch(0.165_0.012_60)]"
      }`}
      data-testid="live-studio"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle
          title="ਲਾਈਵ ਸਟੂਡੀਓ • Live Voice Room"
          sub="Live podcast discussion — mic naal judo! Admin room start karega, tusi sunn sakde ho te hath utha ke discussion vich hissa le sakde ho"
        />

        {/* status strip */}
        <div
          className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-black/30 px-4 py-3"
          data-testid="live-status"
        >
          {st?.active ? (
            <>
              <Badge className="live-dot gap-1.5 border-0 bg-red-600 px-3 py-1 text-xs font-bold text-white">
                <Radio className="h-3.5 w-3.5" /> ON AIR
              </Badge>
              <span className="text-sm font-semibold text-amber-100">
                {st.speakerName ? (
                  <>
                    <MicOff className="mr-1 inline h-4 w-4 text-amber-400" />
                    <span className="font-gur">{st.speakerName}</span> mic te bol rahe ne
                  </>
                ) : (
                  "Mic khali hai — hath chuko te bolna shuru karo!"
                )}
              </span>
              {liveLabel && (
                <span className="ml-auto font-mono text-xs tabular-nums text-amber-300/80">
                  ⏱ {liveLabel}
                </span>
              )}
            </>
          ) : (
            <>
              <Badge variant="outline" className="gap-1.5 border-amber-400/30 px-3 py-1 text-xs text-amber-300">
                <PowerOff className="h-3.5 w-3.5" /> STUDIO OFF
              </Badge>
              <span className="font-gur text-sm text-amber-100/70">
                Live room band hai — admin start karega ta ethe aawaz aavegi
              </span>
            </>
          )}
          <Badge
            variant="outline"
            className={`ml-auto gap-1 border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-300 ${
              st?.active ? "" : "ml-0"
            }`}
          >
            <Headphones className="h-3 w-3" /> {onlineCount} vich shamil
          </Badge>
        </div>

        {!mseOk && (
          <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
            Tuhada browser live audio playback support nahi karda — Chrome ya Edge vich kholo te maza
            lao.
          </p>
        )}

        {wsDown && (
          <p
            className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
            data-testid="live-ws-down"
          >
            Voice room lai realtime (WebSocket) connection chahida hai, jo is serverless hosting
            (Netlify) te available nahi. Live voice discussion main site te chaldi hai — Online Chat
            ithē polling mode vich kaam karega. 🎙️
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---------- left: stage ---------- */}
          <div
            className="flex flex-col overflow-hidden rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)]"
            data-testid="live-stage"
          >
            <div className="flex items-center justify-between border-b border-amber-400/15 bg-black/25 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-100">
                <AudioLines className="h-4.5 w-4.5 text-amber-400" /> Studio Stage
              </h3>
              {speaking && (
                <Badge className="gap-1 border-0 bg-amber-400 text-[10px] font-bold text-black">
                  <Mic className="h-3 w-3" /> TUHADI AAWAZ ON AIR
                </Badge>
              )}
            </div>

            {!joined ? (
              /* ---- join card ---- */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
                <div className="glow-pulse flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-3xl shadow-[0_4px_24px_rgba(245,158,11,0.45)]">
                  🎙️
                </div>
                <p className="font-gur text-center text-sm text-amber-100/70">
                  Live voice room vich shamil hon layi apna naam likho — phir sunn sakde ho, te
                  admin mic deve ta bol vi sakde ho
                </p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  placeholder="Tuhada naam (jiven: Simran)"
                  maxLength={24}
                  disabled={!connected}
                  className="max-w-[260px] border-amber-400/30 bg-black/30 text-amber-50"
                  data-testid="live-name"
                />
                <Button
                  onClick={join}
                  disabled={!connected || !name.trim()}
                  data-testid="live-join"
                  className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
                >
                  {connected ? (
                    <>
                      <Headphones className="mr-1 h-4 w-4" /> Studio vich aao
                    </>
                  ) : (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Connect ho raha hai...
                    </>
                  )}
                </Button>
                {!recOk && (
                  <p className="text-center text-[11px] text-amber-200/50">
                    Note: eh browser mic recording support nahi karda — sunn vi sakde ho, bolan
                    layi Chrome/Edge use karo
                  </p>
                )}
              </div>
            ) : (
              /* ---- stage live view ---- */
              <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
                {/* speaker visual */}
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-[0_8px_32px_rgba(245,158,11,0.4)] ${
                    st?.active ? "glow-pulse bg-gradient-to-br from-amber-400 to-orange-600" : "bg-black/40"
                  }`}
                >
                  {st?.active ? "🎙️" : "💤"}
                </div>

                {st?.active ? (
                  <>
                    <div className="text-center">
                      <p className="font-gur text-lg font-bold text-amber-100">
                        {st.speakerName ?? "Mic khali hai"}
                      </p>
                      <p className="text-xs text-amber-100/60">
                        {imSpeaker
                          ? "Tusi mic te ho — gal karo, sab nu sunai devega!"
                          : st.speakerName
                            ? "Live chal raha hai — thalle volume set karo"
                            : "Admin kisi nu mic devenga, rukho..."}
                      </p>
                    </div>

                    {/* equalizer */}
                    <div className="flex h-9 items-end gap-1.5" aria-hidden="true">
                      {[0.9, 0.55, 1.1, 0.7, 1.0, 0.6, 0.95].map((h, i) => (
                        <span
                          key={i}
                          className={`eq-bar w-1.5 rounded-full bg-gradient-to-t from-orange-600 to-amber-300 ${st.active ? "" : "!transform-none opacity-30"}`}
                          style={{ height: `${h * 34}px`, animationDelay: `${i * 90}ms` }}
                        />
                      ))}
                    </div>

                    {/* volume */}
                    <div className="flex w-full max-w-xs items-center gap-2" data-testid="live-volume-wrap">
                      <Volume2 className="h-4 w-4 shrink-0 text-amber-300" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        aria-label="Voice volume"
                        data-testid="live-volume"
                        className="h-1.5 w-full accent-amber-400"
                      />
                      <span className="w-8 text-right text-[11px] tabular-nums text-amber-200/70">
                        {volume}%
                      </span>
                    </div>

                    {/* listener actions */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {imSpeaker ? (
                        <Button
                          onClick={() => socketRef.current?.emit("voice:release")}
                          variant="outline"
                          data-testid="live-release"
                          className="border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        >
                          <PhoneOff className="mr-1 h-4 w-4" /> Mic chhado
                        </Button>
                      ) : iAmInQueue ? (
                        <Button
                          onClick={() => socketRef.current?.emit("voice:unraise")}
                          variant="outline"
                          data-testid="live-unraise"
                          className="border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                        >
                          <Hand className="mr-1 h-4 w-4" /> Queue vich ho — hath hatao
                        </Button>
                      ) : (
                        <Button
                          onClick={() => socketRef.current?.emit("voice:raise")}
                          data-testid="live-raise"
                          disabled={!recOk}
                          className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
                        >
                          <Hand className="mr-1 h-4 w-4" /> 🙋 Bolna aa — hath chuko
                        </Button>
                      )}
                    </div>
                    {iAmInQueue && (
                      <p className="font-gur text-[11px] text-emerald-300">
                        ✋ Tuhadi hath queue vich hai — admin mic devega ta tuhadi aawaz ON AIR ho
                        javegi
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-gur text-center text-sm text-amber-100/60">
                    Studio band hai — join kite raho, room start hunday hi aawaz apne aap chalu
                    ho javegi
                  </p>
                )}

                {(micErr || err) && (
                  <p className="text-center text-[11px] text-red-400" data-testid="live-error">
                    {micErr || err}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ---------- right: members + host console ---------- */}
          <div className="flex flex-col gap-4">
            {/* members */}
            <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)]">
              <div className="flex items-center justify-between border-b border-amber-400/15 bg-black/25 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-amber-100">
                  <Headphones className="h-4.5 w-4.5 text-amber-400" /> Studio vich kaun aa
                </h3>
                <span className="text-[10px] text-amber-200/60">{onlineCount} log</span>
              </div>
              <div
                className="nice-scroll max-h-44 space-y-1.5 overflow-y-auto p-3"
                data-testid="live-members"
              >
                {members.length === 0 && (
                  <p className="py-4 text-center text-xs text-amber-100/40">
                    Hale koi nahi — pehla tusi join karo!
                  </p>
                )}
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${
                      m.id === myId ? "bg-amber-400/10" : "bg-black/20"
                    }`}
                  >
                    {m.isAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    <span className="font-gur truncate text-sm text-amber-50/90">
                      {m.name}
                      {m.id === myId && <span className="text-amber-300/60"> (tusi)</span>}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {m.id === st?.speakerId && (
                        <Mic className="h-3.5 w-3.5 text-red-400" aria-label="speaker" />
                      )}
                      {m.raised && <Hand className="h-3.5 w-3.5 text-emerald-400" aria-label="hand raised" />}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* host console (admin only) */}
            {isAdmin && (
              <div
                className="overflow-hidden rounded-2xl border border-red-400/30 bg-[oklch(0.21_0.018_60)]"
                data-testid="host-console"
              >
                <div className="flex items-center justify-between border-b border-red-400/20 bg-black/25 px-4 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-red-200">
                    <Crown className="h-4.5 w-4.5 text-amber-400" /> Host Console
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-red-400/40 text-[10px] text-red-300"
                  >
                    admin
                  </Badge>
                </div>
                <div className="space-y-3 p-4">
                  {!joined && (
                    <p className="text-[11px] text-amber-200/60">
                      Pehla upar apne naam naal Studio vich join karo, phir host controls use karo.
                    </p>
                  )}

                  {!st?.active ? (
                    <Button
                      onClick={() => hostAction("host:start")}
                      disabled={!joined || !connected}
                      data-testid="host-start"
                      className="live-dot w-full border-0 bg-red-600 font-bold text-white hover:bg-red-500"
                    >
                      <Radio className="mr-1 h-4 w-4" /> ON AIR — Live Room START karo
                    </Button>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => hostAction("host:claim")}
                          disabled={!joined || !connected || imSpeaker}
                          data-testid="host-claim"
                          className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
                        >
                          <Mic className="mr-1 h-4 w-4" /> Mic lao
                        </Button>
                        <Button
                          onClick={() => hostAction("host:endSpeaker")}
                          disabled={!st.speakerId || imSpeaker}
                          data-testid="host-end-speaker"
                          variant="outline"
                          className="border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                        >
                          <MicOff className="mr-1 h-4 w-4" /> Speaker band
                        </Button>
                      </div>

                      {/* mic queue */}
                      <div className="rounded-xl bg-black/25 p-3">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-300/80">
                          ✋ Mic queue ({st.queue.length})
                        </p>
                        {st.queue.length === 0 ? (
                          <p className="text-[11px] text-amber-100/40">
                            Hale kisi ne hath nahi chukaya
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {st.queue.map((qid, i) => {
                              const m = members.find((x) => x.id === qid);
                              return (
                                <div
                                  key={qid}
                                  className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5"
                                >
                                  <span className="text-[10px] font-bold text-amber-400">
                                    #{i + 1}
                                  </span>
                                  <span className="font-gur truncate text-sm text-amber-50/90">
                                    {m?.name ?? "?"}
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => hostAction("host:grant", { memberId: qid })}
                                    data-testid={`host-grant-${i + 1}`}
                                    className="ml-auto h-7 border-0 bg-emerald-500 px-2.5 text-[11px] font-bold text-black hover:bg-emerald-400"
                                  >
                                    Mic de
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => hostAction("host:stop")}
                        disabled={!connected}
                        data-testid="host-stop"
                        variant="outline"
                        className="w-full border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      >
                        <PowerOff className="mr-1 h-4 w-4" /> Room khatam karo
                      </Button>
                    </>
                  )}
                  <p className="text-[10px] leading-relaxed text-amber-100/40">
                    Tip: mic sirf ik vaike time te ik bande kol hunda — pehla khud bolo, fer queue
                    vichon kisi nala bari bari discussion karo (jive live podcast).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* hidden audio element used for MSE live playback */}
        <audio ref={audioRef} playsInline preload="none" className="hidden" aria-hidden="true" />
      </div>
    </section>
  );
}
