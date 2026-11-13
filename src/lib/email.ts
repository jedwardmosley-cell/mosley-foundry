import "server-only";
import fs from "node:fs";

/**
 * Sends email through Resend (resend.com) with its HTTP API. No SDK needed.
 * Set RESEND_API_KEY and EMAIL_FROM (for example: Both Hands on the Wheel <noreply@mosleyfoundry.com>).
 * For local testing only, EMAIL_DEV_OUTBOX=/path/file.jsonl writes messages to a file instead of sending.
 */
export function emailAvailable() {
  return !!(process.env.EMAIL_DEV_OUTBOX || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM));
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }) {
  if (process.env.EMAIL_DEV_OUTBOX && !process.env.RESEND_API_KEY) {
    fs.appendFileSync(process.env.EMAIL_DEV_OUTBOX!, JSON.stringify({ ...msg, at: new Date().toISOString() }) + "\n");
    return true;
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
  });
  if (!r.ok) console.error("Email send failed", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

/** The public address of the app, for links in emails. Never taken from the request, so a forged host can't redirect a link. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
