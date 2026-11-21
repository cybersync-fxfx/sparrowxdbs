/**
 * Sovereign Open-Source SMTP Mailer (Zero External Dependencies)
 * Connects directly to the self-hosted Postfix + OpenDKIM container (`sparrowx-smtp:587`)
 * or any external RFC-5321 SMTP relay configured via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
 */
import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";
import { env } from "./config.server";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  heloDomain: string;
  configured: boolean;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendMailResult {
  delivered: boolean;
  smtpConfigured: boolean;
  messageId?: string;
  host?: string;
  error?: string;
}

export function getSmtpConfig(): SmtpConfig {
  const domain = env("SPARROWX_DOMAIN") || "sparrowx.net";
  const host = (env("SMTP_HOST") || "").trim();
  const port = Number(env("SMTP_PORT") || 587) || 587;
  const secure = (env("SMTP_SECURE") || "").toLowerCase() === "true" || port === 465;
  const user = (env("SMTP_USER") || "").trim();
  const pass = env("SMTP_PASS") || "";
  const from = (env("SMTP_FROM") || `SparrowX Security <noreply@${domain}>`).trim();
  const heloDomain = (env("SMTP_HELO_DOMAIN") || domain).trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    heloDomain,
    configured: Boolean(host),
  };
}

function extractEnvelopeAddress(headerAddr: string): string {
  const angle = headerAddr.match(/<([^>]+)>/);
  const raw = (angle?.[1] || headerAddr).trim();
  return raw.replace(/[\r\n<>]/g, "");
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuffBody(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function createLineReader(socket: net.Socket | tls.TLSSocket) {
  let buffer = "";
  const queue: string[] = [];
  let waiter: ((line: string) => void) | null = null;
  let errorReject: ((err: Error) => void) | null = null;

  const onData = (chunk: Buffer | string) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        errorReject = null;
        resolve(line);
      } else {
        queue.push(line);
      }
      idx = buffer.indexOf("\n");
    }
  };

  const onError = (err: Error) => {
    if (errorReject) {
      const reject = errorReject;
      waiter = null;
      errorReject = null;
      reject(err);
    }
  };

  const onClose = () => {
    if (errorReject) {
      const reject = errorReject;
      waiter = null;
      errorReject = null;
      reject(new Error("SMTP connection closed unexpectedly"));
    }
  };

  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("close", onClose);

  async function readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    while (true) {
      const line =
        queue.length > 0
          ? queue.shift()!
          : await new Promise<string>((resolve, reject) => {
              waiter = resolve;
              errorReject = reject;
            });
      lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const code = Number.parseInt(line.slice(0, 3), 10);
        return { code, lines };
      }
    }
  }

  function detach() {
    socket.off("data", onData);
    socket.off("error", onError);
    socket.off("close", onClose);
  }

  return { readResponse, detach };
}

function writeCmd(socket: net.Socket | tls.TLSSocket, cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${cmd}\r\n`, "utf8", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function sendSmtpEmail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    return {
      delivered: false,
      smtpConfigured: false,
      error: "SMTP_HOST is not configured. Run deploy/smtp-setup.sh or set SMTP_HOST in .env.",
    };
  }

  const envelopeFrom = extractEnvelopeAddress(cfg.from);
  const envelopeTo = extractEnvelopeAddress(input.to);
  if (!envelopeTo || !envelopeTo.includes("@")) {
    return { delivered: false, smtpConfigured: true, error: "Invalid recipient email address" };
  }

  const messageId = `<${crypto.randomBytes(12).toString("hex")}@${cfg.heloDomain}>`;
  const boundary = `spx_${crypto.randomBytes(12).toString("hex")}`;
  const rawMessage = [
    `From: ${sanitizeHeaderValue(cfg.from)}`,
    `To: <${envelopeTo}>`,
    `Subject: ${sanitizeHeaderValue(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `X-SparrowX-Mailer: SparrowX-Sovereign-SMTP/1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    input.text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    input.html,
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");

  let socket: net.Socket | tls.TLSSocket | null = null;
  const timeoutMs = 12_000;

  try {
    socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
      const s = cfg.secure
        ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: false })
        : net.createConnection({ host: cfg.host, port: cfg.port });
      s.setTimeout(timeoutMs, () => {
        s.destroy(new Error(`SMTP connection timed out after ${timeoutMs}ms`));
      });
      s.once("error", reject);
      s.once(cfg.secure ? "secureConnect" : "connect", () => {
        s.off("error", reject);
        resolve(s);
      });
    });

    let reader = createLineReader(socket);
    const greet = await reader.readResponse();
    if (greet.code !== 220) {
      throw new Error(`SMTP greeting failed (${greet.code}): ${greet.lines.join(" ")}`);
    }

    await writeCmd(socket, `EHLO ${cfg.heloDomain}`);
    let ehlo = await reader.readResponse();
    if (ehlo.code !== 250) {
      await writeCmd(socket, `HELO ${cfg.heloDomain}`);
      ehlo = await reader.readResponse();
      if (ehlo.code !== 250) {
        throw new Error(`SMTP EHLO/HELO failed (${ehlo.code})`);
      }
    }

    const supportsStartTls = ehlo.lines.some((l) => /STARTTLS/i.test(l));
    if (!cfg.secure && supportsStartTls) {
      await writeCmd(socket, "STARTTLS");
      const tlsResp = await reader.readResponse();
      if (tlsResp.code === 220) {
        reader.detach();
        const plainSocket = socket;
        socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
          const upgraded = tls.connect({
            socket: plainSocket,
            servername: cfg.host,
            rejectUnauthorized: false,
          });
          upgraded.once("error", reject);
          upgraded.once("secureConnect", () => {
            upgraded.off("error", reject);
            resolve(upgraded);
          });
        });
        reader = createLineReader(socket);
        await writeCmd(socket, `EHLO ${cfg.heloDomain}`);
        ehlo = await reader.readResponse();
      }
    }

    if (cfg.user && cfg.pass) {
      const supportsPlain = ehlo.lines.some((l) => /AUTH.*\bPLAIN\b/i.test(l));
      if (supportsPlain) {
        const token = Buffer.from(`\u0000${cfg.user}\u0000${cfg.pass}`, "utf8").toString("base64");
        await writeCmd(socket, `AUTH PLAIN ${token}`);
        const authRes = await reader.readResponse();
        if (authRes.code !== 235) {
          throw new Error(`SMTP AUTH PLAIN failed (${authRes.code})`);
        }
      } else {
        await writeCmd(socket, "AUTH LOGIN");
        const step1 = await reader.readResponse();
        if (step1.code !== 334) throw new Error(`SMTP AUTH LOGIN rejected (${step1.code})`);
        await writeCmd(socket, Buffer.from(cfg.user, "utf8").toString("base64"));
        const step2 = await reader.readResponse();
        if (step2.code !== 334) throw new Error(`SMTP AUTH user rejected (${step2.code})`);
        await writeCmd(socket, Buffer.from(cfg.pass, "utf8").toString("base64"));
        const step3 = await reader.readResponse();
        if (step3.code !== 235) throw new Error(`SMTP AUTH pass rejected (${step3.code})`);
      }
    }

    await writeCmd(socket, `MAIL FROM:<${envelopeFrom}>`);
    const mailRes = await reader.readResponse();
    if (mailRes.code !== 250) {
      throw new Error(`SMTP MAIL FROM failed (${mailRes.code}): ${mailRes.lines.join(" ")}`);
    }

    await writeCmd(socket, `RCPT TO:<${envelopeTo}>`);
    const rcptRes = await reader.readResponse();
    if (rcptRes.code !== 250 && rcptRes.code !== 251) {
      throw new Error(`SMTP RCPT TO failed (${rcptRes.code}): ${rcptRes.lines.join(" ")}`);
    }

    await writeCmd(socket, "DATA");
    const dataPrompt = await reader.readResponse();
    if (dataPrompt.code !== 354) {
      throw new Error(`SMTP DATA rejected (${dataPrompt.code})`);
    }

    await writeCmd(socket, `${dotStuffBody(rawMessage)}\r\n.`);
    const sentRes = await reader.readResponse();
    if (sentRes.code !== 250) {
      throw new Error(`SMTP message rejected (${sentRes.code}): ${sentRes.lines.join(" ")}`);
    }

    await writeCmd(socket, "QUIT").catch(() => {});
    reader.detach();
    socket.end();

    return {
      delivered: true,
      smtpConfigured: true,
      messageId,
      host: `${cfg.host}:${cfg.port}`,
    };
  } catch (err) {
    if (socket && !socket.destroyed) socket.destroy();
    return {
      delivered: false,
      smtpConfigured: true,
      host: `${cfg.host}:${cfg.port}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildVerificationEmailTemplate(params: {
  fullName: string;
  code: string;
  verifyUrl: string;
  serviceName: string;
  domain: string;
}): { subject: string; text: string; html: string } {
  const safeName = params.fullName || "Developer";
  const subject = `${params.code} is your SparrowX verification code`;
  const text = [
    `Hello ${safeName},`,
    ``,
    `Welcome to ${params.serviceName} on SparrowX.`,
    `Use this 6-digit verification code to verify your email address across all SparrowX services:`,
    ``,
    `  Verification Code: ${params.code}`,
    ``,
    `Or click the 1-click verification link (valid for 15 minutes):`,
    `  ${params.verifyUrl}`,
    ``,
    `If you did not create this account on ${params.domain}, you can safely ignore this email.`,
    ``,
    `— SparrowX Autonomous Security & Sovereign Cloud`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#07090f;color:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:0 auto;background:#0e121b;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="padding:28px 28px 18px;border-bottom:1px solid #1e293b;">
        <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#f96246;font-weight:700;">SparrowX Unified Identity</div>
        <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#ffffff;">Verify your email address</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;">
          Hi <strong style="color:#ffffff;">${safeName.replace(/[<>&"]/g, "")}</strong>,<br/>
          Enter this verification code to activate your unified SparrowX account for <strong>${params.serviceName.replace(/[<>&"]/g, "")}</strong> and all linked services.
        </p>
        <div style="margin:20px 0;padding:18px;background:#07090f;border:1px solid #334155;border-radius:10px;text-align:center;">
          <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">6-Digit Verification Code</div>
          <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;">${params.code}</div>
          <div style="font-size:11px;color:#64748b;margin-top:8px;">Expires in 15 minutes</div>
        </div>
        <div style="text-align:center;margin:22px 0;">
          <a href="${params.verifyUrl}" style="display:inline-block;padding:12px 24px;background:#ffffff;color:#07090f;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">Verify Email Instantly</a>
        </div>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
          If the button doesn't work, copy this link into your browser:<br/>
          <span style="color:#94a3b8;word-break:break-all;">${params.verifyUrl}</span>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#090c14;border-top:1px solid #1e293b;font-size:11px;color:#64748b;">
        Sent directly by SparrowX Sovereign SMTP (${params.domain}) · If you did not request this, ignore this email.
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
