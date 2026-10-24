/**
 * CooCoo Radio — Live Chat Service (socket.io)
 * Port 3003. Frontend connects via io("/?XTransformPort=3003", { path: "/" }).
 */
import { createServer } from "http";
import { Server, type Socket } from "socket.io";

const PORT = 3003;
const MAX_HISTORY = 80;
const MAX_LEN = 300;
const MIN_INTERVAL_MS = 700;

interface ChatMsg {
  id: string;
  name: string;
  text: string;
  at: number;
  type: "user" | "system";
}

interface User {
  id: string;
  name: string;
  joinedAt: number;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const users = new Map<string, User>();
const history: ChatMsg[] = [];
const lastSentAt = new Map<string, number>();

const genId = () => Math.random().toString(36).slice(2, 11);

const sysMsg = (text: string): ChatMsg => ({
  id: genId(),
  name: "CooCoo Radio",
  text,
  at: Date.now(),
  type: "system",
});

const pushHistory = (m: ChatMsg) => {
  history.push(m);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
};

const sanitize = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);

const broadcastUsers = () => {
  io.emit("chat:users", {
    count: users.size,
    users: Array.from(users.values()).map((u) => ({ id: u.id, name: u.name })),
  });
};

io.on("connection", (socket: Socket) => {
  // send recent history + current user list on connect
  socket.emit("chat:history", history.slice(-30));
  socket.emit("chat:users", {
    count: users.size,
    users: Array.from(users.values()).map((u) => ({ id: u.id, name: u.name })),
  });

  socket.on("chat:join", (data: { name?: string }) => {
    const name = sanitize(data?.name, 24) || "Sarota";
    users.set(socket.id, { id: socket.id, name, joinedAt: Date.now() });
    const m = sysMsg(`🐓 ${name} chat vich aa gaya!`);
    pushHistory(m);
    io.emit("chat:message", m);
    broadcastUsers();
    console.log(`[join] ${name} (${socket.id}) — online: ${users.size}`);
  });

  socket.on("chat:message", (data: { text?: string; name?: string }) => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit("chat:error", { error: "Pehla apna naam do (join karo)" });
      return;
    }
    // simple flood guard
    const now = Date.now();
    const last = lastSentAt.get(socket.id) || 0;
    if (now - last < MIN_INTERVAL_MS) {
      socket.emit("chat:error", { error: "Thoda slow ji 😊" });
      return;
    }
    const text = sanitize(data?.text, MAX_LEN);
    if (!text) return;
    lastSentAt.set(socket.id, now);
    const m: ChatMsg = {
      id: genId(),
      name: user.name,
      text,
      at: now,
      type: "user",
    };
    pushHistory(m);
    io.emit("chat:message", m);
    console.log(`[msg] ${user.name}: ${text.slice(0, 60)}`);
  });

  socket.on("chat:rename", (data: { name?: string }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const name = sanitize(data?.name, 24);
    if (!name) return;
    const m = sysMsg(`${user.name} hun ${name} ban gaya`);
    user.name = name;
    pushHistory(m);
    io.emit("chat:message", m);
    broadcastUsers();
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      lastSentAt.delete(socket.id);
      const m = sysMsg(`${user.name} chala gaya`);
      pushHistory(m);
      io.emit("chat:message", m);
      broadcastUsers();
      console.log(`[left] ${user.name} — online: ${users.size}`);
    }
  });

  socket.on("error", (err) => {
    console.error(`[socket-error] ${socket.id}:`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🐓 CooCoo live chat service running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
