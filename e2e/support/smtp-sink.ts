import net from "node:net";

// A mail server that keeps what it is given, for the end-to-end tests that need the link and the code of a
// mail (TOKI-097). It speaks the few SMTP commands the mail layer sends, and nothing else. Fake addresses
// only; it listens on the loopback address.
export type Mail = { to: string; text: string };

// Quoted-printable text back to plain text: soft line breaks go, `=XX` becomes the character.
function unquote(raw: string): string {
  return raw
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_m, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

export async function startSmtpSink(port: number) {
  const mails: Mail[] = [];
  const server = net.createServer((socket) => {
    let buffer = "";
    let recipients: string[] = [];
    let data: string | null = null;
    socket.write("220 sink ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (data !== null) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) {
            data += buffer;
            buffer = "";
            // keep the last four characters: the end marker can arrive split
            if (data.length > 4) {
              buffer = data.slice(-4);
              data = data.slice(0, -4);
            }
            return;
          }
          const body = data + buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          data = null;
          const text = unquote(body);
          for (const to of recipients) mails.push({ to, text });
          recipients = [];
          socket.write("250 queued\r\n");
          continue;
        }
        const eol = buffer.indexOf("\r\n");
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === "EHLO" || verb === "HELO") socket.write("250 sink\r\n");
        else if (verb === "MAIL") socket.write("250 ok\r\n");
        else if (verb === "RCPT") {
          const match = /<([^>]+)>/.exec(line);
          if (match) recipients.push(match[1]!.toLowerCase());
          socket.write("250 ok\r\n");
        } else if (verb === "DATA") {
          data = "";
          socket.write("354 go ahead\r\n");
        } else if (verb === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
          return;
        } else socket.write("250 ok\r\n");
      }
    });
    socket.on("error", () => {});
  });
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve()),
  );

  // The next mail to an address that arrived after `after` mails were counted.
  async function nextMail(to: string, after: number): Promise<Mail> {
    const wanted = to.toLowerCase();
    for (let i = 0; i < 100; i += 1) {
      const found = mails.slice(after).find((m) => m.to === wanted);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`no mail arrived for ${to}`);
  }

  return {
    mails,
    nextMail,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** The 6 digits of a mail: the one line that holds nothing else. */
export function codeOf(mail: Mail): string {
  const match = /^\s*(\d{6})\s*$/m.exec(mail.text);
  if (!match) throw new Error("no code in the mail");
  return match[1]!;
}

/** The Join link of an invitation mail. */
export function joinLinkOf(mail: Mail): string {
  const match = /(http:\/\/127\.0\.0\.1:\d+\/join#[A-Za-z0-9_-]{43})/.exec(
    mail.text,
  );
  if (!match) throw new Error("no Join link in the mail");
  return match[1]!;
}
