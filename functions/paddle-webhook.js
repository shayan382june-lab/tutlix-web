import { getStore } from "@netlify/blobs";

// Paddle notifies us about renewals and cancellations here.
// Env vars (Netlify): PADDLE_WEBHOOK_SECRET
const env = (k) => { try { return Netlify.env.get(k); } catch { return undefined; } };
const members = () => getStore({ name: "members", consistency: "strong" });
const index = () => getStore({ name: "paddle", consistency: "strong" });
const GRACE = 3 * 24 * 3600 * 1000;

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), (x) => x.toString(16).padStart(2, "0")).join("");
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export default async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = env("PADDLE_WEBHOOK_SECRET");
  const raw = await req.text();
  const head = req.headers.get("paddle-signature") || "";
  const parts = Object.fromEntries(head.split(";").map((p) => p.split("=")));
  if (!secret || !parts.ts || !parts.h1) return new Response("unauthorised", { status: 401 });
  if (Math.abs(Date.now() / 1000 - Number(parts.ts)) > 300) return new Response("stale", { status: 401 });
  const expected = await hmac(secret, `${parts.ts}:${raw}`);
  if (!safeEq(expected, parts.h1)) return new Response("bad signature", { status: 401 });

  let ev = {};
  try { ev = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const type = ev.event_type || "", d = ev.data || {};
  if (!type.startsWith("subscription.")) return new Response("ignored", { status: 200 });

  const link = await index().get("sub:" + d.id, { type: "json" });
  if (!link) return new Response("unknown subscription", { status: 200 }); // code not claimed yet; claim sets expiry itself
  const s = members();
  const rec = await s.get(link.code, { type: "json" });
  if (!rec) return new Response("no member", { status: 200 });

  const periodEnd = d.current_billing_period && d.current_billing_period.ends_at ? Date.parse(d.current_billing_period.ends_at) : null;
  if (d.status === "active" || d.status === "trialing") {
    if (periodEnd) rec.expires = periodEnd + GRACE;
    rec.revoked = false;
  } else if (d.status === "past_due") {
    // keep access during Paddle's retry period, until the current expiry
  } else if (d.status === "canceled" || d.status === "paused") {
    const end = d.canceled_at ? Date.parse(d.canceled_at) : Date.now();
    rec.expires = Math.min(rec.expires || end, Math.max(end, Date.now()));
  }
  rec.paddleStatus = d.status;
  await s.setJSON(link.code, rec);
  return new Response("ok", { status: 200 });
};

export const config = { path: "/api/paddle-webhook" };
