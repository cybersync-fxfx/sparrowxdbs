import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildVerificationEmailTemplate,
  sendSmtpEmail,
} from "@/lib/server/email.server";
import {
  isEmailVerifiedInDb,
  issueAndSendEmailVerification,
  resetEmailVerificationMemoryForTests,
  verifyEmailCodeOrToken,
} from "@/lib/server/email-verification.server";

function startMockSmtpServer() {
  const receivedData: string[] = [];
  let inData = false;
  let currentMsg = "";

  const server = net.createServer((socket) => {
    socket.write("220 mail.sparrowx.net ESMTP SparrowX Test\r\n");
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx = buf.indexOf("\r\n");
      while (idx !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            receivedData.push(currentMsg);
            currentMsg = "";
            socket.write("250 2.0.0 Ok: queued as TEST123\r\n");
          } else {
            currentMsg += `${line}\r\n`;
          }
        } else if (/^EHLO|^HELO/i.test(line)) {
          socket.write("250-mail.sparrowx.net\r\n250 SIZE 10485760\r\n");
        } else if (/^MAIL FROM:/i.test(line) || /^RCPT TO:/i.test(line)) {
          socket.write("250 2.1.0 Ok\r\n");
        } else if (/^DATA$/i.test(line)) {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^QUIT$/i.test(line)) {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 Ok\r\n");
        }
        idx = buf.indexOf("\r\n");
      }
    });
  });

  return new Promise<{ port: number; receivedData: string[]; close: () => Promise<void> }>(
    (resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("Invalid server address"));
          return;
        }
        resolve({
          port: addr.port,
          receivedData,
          close: () => new Promise((res) => server.close(() => res())),
        });
      });
    },
  );
}

describe("Self-Hosted Sovereign SMTP & Unified Email Verification", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    resetEmailVerificationMemoryForTests();
    for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "POSTGRES_HOST", "DATABASE_URL"]) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("delivers multipart verification email over RFC-5321 SMTP and verifies 6-digit OTP", async () => {
    const smtp = await startMockSmtpServer();
    try {
      process.env.SMTP_HOST = "127.0.0.1";
      process.env.SMTP_PORT = String(smtp.port);
      process.env.SMTP_SECURE = "false";
      process.env.SMTP_FROM = "SparrowX Security <noreply@sparrowx.net>";
      delete process.env.POSTGRES_HOST;
      delete process.env.DATABASE_URL;

      const sendRes = await issueAndSendEmailVerification({
        email: "alice@example.com",
        fullName: "Alice Dev",
        serviceName: "SparrowX Cloud DB",
        origin: "https://db.sparrowx.net",
      });

      expect(sendRes.ok).toBe(true);
      expect(sendRes.delivered).toBe(true);
      expect(smtp.receivedData.length).toBe(1);

      const rawMail = smtp.receivedData[0] ?? "";
      expect(rawMail).toContain("To: <alice@example.com>");
      expect(rawMail).toContain("SparrowX Cloud DB");

      const codeMatch = rawMail.match(/Verification Code:\s*(\d{6})/);
      expect(codeMatch?.[1]).toMatch(/^\d{6}$/);

      // Reject wrong code cleanly
      const badRes = await verifyEmailCodeOrToken({
        email: "alice@example.com",
        code: "000000",
      });
      expect(badRes.verified).toBe(false);

      // Accept real 6-digit code
      const okRes = await verifyEmailCodeOrToken({
        email: "alice@example.com",
        code: codeMatch![1]!,
      });
      expect(okRes.ok).toBe(true);
      expect(okRes.verified).toBe(true);
      expect(await isEmailVerifiedInDb("alice@example.com")).toBe(true);

      // Re-using consumed code must fail
      const replayRes = await verifyEmailCodeOrToken({
        email: "alice@example.com",
        code: codeMatch![1]!,
      });
      expect(replayRes.verified).toBe(false);
    } finally {
      await smtp.close();
    }
  });

  it("enforces 60-second resend cooldown and verifies 1-click magic link tokens", async () => {
    const smtp = await startMockSmtpServer();
    try {
      process.env.SMTP_HOST = "127.0.0.1";
      process.env.SMTP_PORT = String(smtp.port);
      process.env.SMTP_SECURE = "false";
      delete process.env.POSTGRES_HOST;
      delete process.env.DATABASE_URL;

      const first = await issueAndSendEmailVerification({
        email: "bob@example.com",
        origin: "https://sparrowx.net",
      });
      expect(first.ok).toBe(true);

      const tooSoon = await issueAndSendEmailVerification({
        email: "bob@example.com",
        origin: "https://sparrowx.net",
      });
      expect(tooSoon.ok).toBe(false);
      expect(tooSoon.retryAfterSeconds).toBeGreaterThan(0);

      const rawMail = smtp.receivedData[0] ?? "";
      const tokenMatch = rawMail.match(/token=([a-f0-9]{48})/);
      expect(tokenMatch?.[1]).toBeTruthy();

      const linkRes = await verifyEmailCodeOrToken({
        email: "bob@example.com",
        token: tokenMatch![1]!,
      });
      expect(linkRes.verified).toBe(true);
    } finally {
      await smtp.close();
    }
  });

  it("returns smtpConfigured=false cleanly when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;
    const tpl = buildVerificationEmailTemplate({
      fullName: "Test User",
      code: "654321",
      verifyUrl: "https://sparrowx.net/api/auth/verify-email?email=a@b.c&token=abc",
      serviceName: "SparrowX",
      domain: "sparrowx.net",
    });
    const res = await sendSmtpEmail({
      to: "a@b.c",
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    expect(res.delivered).toBe(false);
    expect(res.smtpConfigured).toBe(false);
  });
});
