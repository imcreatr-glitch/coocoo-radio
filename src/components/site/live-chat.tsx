"use client";

/**
 * CooCoo Radio — Online Chat
 * Primary transport: socket.io mini-service (:3003) via gateway — realtime.
 * Fallback: on serverless hosting (Netlify) the WebSocket mini-service is not
 * available, so after a short grace period the chat automatically switches to
 * HTTP polling through /api/chat (3s interval).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { MessageCircle, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isOnAir, type ShowItem } from "@/lib/types";

interface ChatMsg {
  id: string;
  name: string;
  text: string;
  at: number;
  type: "user" | "system";
}

type Mode = "connecting" | "socket" | "poll";

const NAME_KEY = "coocoo_chat_name";

/**
 * Socket URL strategy:
 * - Behind the preview/sandbox gateway the XTransformPort query routes to the
 *   chat mini-service.
 * - When the project runs locally on :3000 there is no gateway, so connect
 *   straight to the service port (cross-origin is fine, service has CORS *).
 * - On serverless hosting (Netlify) the gateway path fails and the component
 *   automatically falls back to HTTP polling via /api/chat.
 */
function chatSocketUrl(): string {
  if (typeof window === "undefined") return "/?XTransformPort=3003";
  const host = window.location.hostname;
  const isLocalDev =
    (host === "localhost" || host === "127.0.0.1") && window.location.port === "3000";
  return isLocalDev ? "http://localhost:3003" : "/?XTransformPort=3003";
}

function mergeMsgs(prev: ChatMsg[], incoming: ChatMsg[]): ChatMsg[] {
  const seen = new Set(prev.map((p) => p.id));
  const merged = [...prev];
  for (const m of incoming) {
    if (m && m.id && !seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  }
  return merged.sort((a, b) => a.at - b.at);
}

export default function LiveChat() {
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("connecting");
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState(0);
  const [onAirShow, setOnAirShow] = useState<string | null>(null);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // fetch current show for ON AIR banner
  useEffect(() => {
    const compute = () => {
      fetch("/api/shows", { cache: "no-store" })
        .then((r) => r.json())
        .then((shows: ShowItem[]) => {
          if (!Array.isArray(shows)) return;
          const now = new Date();
          const day = now.getDay();
          const minutes = now.getHours() * 60 + now.getMinutes();
          const live = shows.find((s) => isOnAir(s, day, minutes));
          setOnAirShow(live ? live.title : null);
        })
        .catch(() => {});
    };
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, []);

  // ---- polling fallback (serverless-safe) ----
  const startPolling = useCallback(() => {
    setMode((m) => (m === "socket" ? m : "poll"));
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    const pull = async () => {
      try {
        const r = await fetch("/api/chat", { cache: "no-store" });
        if (!r.ok) return;
        const rows = (await r.json()) as ChatMsg[];
        if (Array.isArray(rows)) setMessages((prev) => mergeMsgs(prev, rows));
      } catch {
        /* transient network error — next tick retries */
      }
    };
    pull();
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(pull, 3000);
  }, []);

  // ---- socket transport (primary) ----
  useEffect(() => {
    const s = io(chatSocketUrl(), {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1200,
      timeout: 6000,
    });
    socketRef.current = s;

    // if the socket can't connect (e.g. serverless hosting), fall back to polling
    const failTimer = window.setTimeout(() => {
      if (!s.connected) startPolling();
    }, 4500);

    s.on("connect", () => {
      window.clearTimeout(failTimer);
      setMode("socket");
    });
    s.on("disconnect", () => setMode((m) => (m === "poll" ? m : "connecting")));
    s.on("connect_error", () => setMode((m) => (m === "poll" ? m : "connecting")));

    s.on("chat:history", (hist: ChatMsg[]) => {
      if (Array.isArray(hist)) setMessages(hist);
    });
    s.on("chat:message", (m: ChatMsg) => {
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    });
    s.on("chat:users", (d: { count: number }) => setOnline(d?.count ?? 0));
    s.on("chat:error", (d: { error: string }) => setError(d?.error || ""));

    return () => {
      window.clearTimeout(failTimer);
      if (pollRef.current) window.clearInterval(pollRef.current);
      s.disconnect();
    };
  }, [startPolling]);

  // auto-scroll to newest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // restore saved name (async so we don't setState synchronously in effect)
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const join = useCallback(() => {
    const n = name.trim();
    if (!n) return;
    window.localStorage.setItem(NAME_KEY, n);
    if (mode === "socket" && socketRef.current) {
      socketRef.current.emit("chat:join", { name: n });
    }
    setJoined(true);
  }, [name, mode]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    if (mode === "socket" && socketRef.current) {
      socketRef.current.emit("chat:message", { text: t });
      setText("");
      setError("");
      return;
    }
    if (mode === "poll") {
      setText("");
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || window.localStorage.getItem(NAME_KEY) || "Listener",
            text: t,
          }),
        });
        const row = (await r.json()) as ChatMsg & { error?: string };
        if (!r.ok) {
          setError(row?.error || "Message send nahi hoya — phir try karo");
          return;
        }
        if (row && row.id) setMessages((prev) => mergeMsgs(prev, [row]));
      } catch {
        setError("Network error — phir try karo");
      }
    }
  }, [text, mode, name]);

  const ready = mode !== "connecting";
  const dotClass =
    mode === "socket" ? "bg-emerald-400 live-dot" : mode === "poll" ? "bg-amber-400" : "bg-red-500";

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)]"
      data-testid="live-chat"
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-400/15 bg-black/25 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4.5 w-4.5 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-100">Online Chat</h3>
        </div>
        <div className="flex items-center gap-2">
          {mode === "socket" ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-300"
            >
              <Users className="h-3 w-3" /> {online} online
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-300"
              title="Serverless hosting — chat polling mode"
            >
              live • poll
            </Badge>
          )}
          <span
            className={`h-2 w-2 rounded-full ${dotClass}`}
            title={mode === "socket" ? "Realtime chat connected" : mode === "poll" ? "Polling mode" : "Connect ho raha hai"}
          />
        </div>
      </div>

      {/* on-air banner */}
      {onAirShow && (
        <div className="border-b border-amber-400/15 bg-red-600/15 px-4 py-1.5 text-center text-[11px] font-semibold text-red-300">
          🔴 ON AIR: {onAirShow} — show de doran chat karo!
        </div>
      )}

      {!joined ? (
        /* ---- name entry ---- */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="font-gur text-center text-sm text-amber-100/70">
            Chat vich shamil hon layi apna naam likho
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="Tuhada naam (jiven: Sandeep)"
            maxLength={24}
            disabled={!ready}
            className="max-w-[240px] border-amber-400/30 bg-black/30 text-amber-50"
            data-testid="chat-name-input"
          />
          <Button
            onClick={join}
            disabled={!ready || !name.trim()}
            data-testid="chat-join"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {ready ? "Chat vich aao 💬" : "Connect ho raha hai..."}
          </Button>
        </div>
      ) : (
        <>
          {/* ---- messages ---- */}
          <div
            ref={listRef}
            className="nice-scroll max-h-72 min-h-[220px] flex-1 space-y-2 overflow-y-auto px-4 py-3"
            data-testid="chat-messages"
          >
            {messages.map((m) =>
              m.type === "system" ? (
                <p key={m.id} className="text-center text-[11px] italic text-amber-200/40">
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className="rounded-xl bg-black/25 px-3 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300">{m.name}</span>
                    <span className="text-[10px] text-amber-100/35">
                      {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="break-words text-sm text-amber-50/90">{m.text}</p>
                </div>
              )
            )}
            {messages.length === 0 && (
              <p className="pt-8 text-center text-xs text-amber-100/40">
                Hun tak koi gal nahi hoi — pehla message tusi bhejo!
              </p>
            )}
          </div>

          {/* ---- input ---- */}
          <div className="border-t border-amber-400/15 bg-black/25 p-3">
            {error && <p className="mb-1.5 text-center text-[11px] text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Apna message likho..."
                maxLength={300}
                className="border-amber-400/30 bg-black/40 text-amber-50"
                data-testid="chat-input"
              />
              <Button
                size="icon"
                onClick={send}
                disabled={!text.trim()}
                aria-label="Message bhejo"
                data-testid="chat-send"
                className="shrink-0 border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-300 hover:to-orange-400"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
