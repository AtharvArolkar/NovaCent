import net from "node:net";
import tls from "node:tls";

type SmtpSocket = net.Socket | tls.TLSSocket;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatMessage({
  from,
  to,
  subject,
  text
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  return [
    `From: ${escapeHeader(from)}`,
    `To: ${escapeHeader(to)}`,
    `Subject: ${escapeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text.replace(/\r?\n/g, "\r\n")
  ].join("\r\n");
}

async function readSmtpResponse(socket: SmtpSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (/^\d{3}\s/.test(last ?? "")) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: SmtpSocket, command: string, expected: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${command} -> ${response.trim()}`);
  }
  return response;
}

async function connectSmtp() {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is required to send email.");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  await new Promise<void>((resolve, reject) => {
    socket.once(secure ? "secureConnect" : "connect", resolve);
    socket.once("error", reject);
  });
  await readSmtpResponse(socket);

  if (!secure) {
    await sendCommand(socket, `EHLO ${process.env.SMTP_HELO_DOMAIN ?? "novacent.local"}`, [250]);
    await sendCommand(socket, "STARTTLS", [220]);
    const secureSocket = tls.connect({ socket, servername: host });
    await new Promise<void>((resolve, reject) => {
      secureSocket.once("secureConnect", resolve);
      secureSocket.once("error", reject);
    });
    return secureSocket;
  }

  return socket;
}

export async function sendEmail({
  to,
  subject,
  text
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM is required to send email.");
  const socket = await connectSmtp();

  try {
    await sendCommand(socket, `EHLO ${process.env.SMTP_HELO_DOMAIN ?? "novacent.local"}`, [250]);
    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      await sendCommand(socket, "AUTH LOGIN", [334]);
      await sendCommand(socket, encodeBase64(process.env.SMTP_USER), [334]);
      await sendCommand(socket, encodeBase64(process.env.SMTP_PASSWORD), [235]);
    }
    await sendCommand(socket, `MAIL FROM:<${process.env.SMTP_ENVELOPE_FROM ?? from.replace(/^.*<|>.*$/g, "")}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${formatMessage({ from, to, subject, text }).replace(/^\./gm, "..")}\r\n.\r\n`);
    const response = await readSmtpResponse(socket);
    const code = Number(response.slice(0, 3));
    if (code !== 250) {
      throw new Error(`SMTP DATA failed: ${response.trim()}`);
    }
    await sendCommand(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
  }
}
