import { simpleParser, type ParsedMail } from "mailparser";
import {
  createServer as createNetServer,
  type Server,
  type Socket,
} from "node:net";
import { SMTPServer, type SMTPServerOptions } from "smtp-server";

// A real SMTP server for the mail tests (spec, Testing). It listens on an
// ephemeral port of 127.0.0.1, records what it received and how many
// connections were open, and can be told to misbehave. Fake values only.
export type Reply = { code: number; message: string };

export type Behaviour = {
  // Reply with this code to the command instead of accepting it.
  fail?: Partial<Record<"mailFrom" | "rcptTo" | "data" | "auth", Reply>>;
  // Wait this long before answering MAIL FROM, RCPT TO, DATA and AUTH.
  delayMs?: number;
  // Wait this long before answering only the DATA command (after the body).
  dataDelayMs?: number;
  // Passed to smtp-server: certificate, secure, disabledCommands, ...
  server?: SMTPServerOptions;
  // Accept this login only.
  login?: { user: string; password: string };
};

export type TestSmtp = {
  port: number;
  // Messages whose DATA was answered with 250, oldest first.
  received: () => Promise<ParsedMail[]>;
  rawReceived: () => string[];
  attemptedData: () => number;
  openConnections: () => number;
  maxOpenConnections: () => number;
  totalConnections: () => number;
  close: () => Promise<void>;
};

function replyError(reply: Reply): Error {
  return Object.assign(new Error(reply.message), {
    responseCode: reply.code,
  });
}

export async function startSmtp(behaviour: Behaviour = {}): Promise<TestSmtp> {
  const raw: string[] = [];
  let attempts = 0;
  let open = 0;
  let max = 0;
  let total = 0;
  const sockets = new Set<Socket>();
  const pause = (ms: number | undefined) =>
    ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

  const server = new SMTPServer({
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: [],
    logger: false,
    ...behaviour.server,
    onAuth(auth, _session, callback) {
      void pause(behaviour.delayMs).then(() => {
        if (behaviour.fail?.auth)
          return callback(replyError(behaviour.fail.auth));
        const ok =
          !behaviour.login ||
          (auth.username === behaviour.login.user &&
            auth.password === behaviour.login.password);
        if (!ok)
          return callback(
            Object.assign(new Error("Invalid login"), { responseCode: 535 }),
          );
        callback(null, { user: auth.username ?? "user" });
      });
    },
    onMailFrom(_address, _session, callback) {
      void pause(behaviour.delayMs).then(() =>
        callback(
          behaviour.fail?.mailFrom ? replyError(behaviour.fail.mailFrom) : null,
        ),
      );
    },
    onRcptTo(_address, _session, callback) {
      void pause(behaviour.delayMs).then(() =>
        callback(
          behaviour.fail?.rcptTo ? replyError(behaviour.fail.rcptTo) : null,
        ),
      );
    },
    onData(stream, _session, callback) {
      attempts += 1;
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        void pause(behaviour.delayMs ?? behaviour.dataDelayMs).then(() => {
          if (behaviour.fail?.data)
            return callback(replyError(behaviour.fail.data));
          raw.push(Buffer.concat(chunks).toString("utf8"));
          callback(null);
        });
      });
    },
  });
  server.server.on("connection", (socket: Socket) => {
    open += 1;
    total += 1;
    max = Math.max(max, open);
    sockets.add(socket);
    socket.on("close", () => {
      open -= 1;
      sockets.delete(socket);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    port,
    received: () => Promise.all(raw.map((r) => simpleParser(r))),
    rawReceived: () => [...raw],
    attemptedData: () => attempts,
    openConnections: () => open,
    maxOpenConnections: () => max,
    totalConnections: () => total,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// Accepts the connection and never says a word, so a client waits for the greeting.
export async function startSilentServer(): Promise<{
  port: number;
  connections: () => number;
  openConnections: () => number;
  maxOpenConnections: () => number;
  close: () => Promise<void>;
}> {
  let total = 0;
  let open = 0;
  let max = 0;
  const sockets = new Set<Socket>();
  const server: Server = createNetServer((socket) => {
    total += 1;
    open += 1;
    max = Math.max(max, open);
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => {
      open -= 1;
      sockets.delete(socket);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    port,
    connections: () => total,
    openConnections: () => open,
    maxOpenConnections: () => max,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
