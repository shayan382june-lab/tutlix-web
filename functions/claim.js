import { getStore } from "@netlify/blobs";

// After a Paddle checkout, the website sends the transaction ID here.
// We confirm the payment with Paddle, then create (once) a personal access code.
// Env vars (Netlify): PADDLE_API_KEY, PADDLE_ENV ("sandbox" or "live"), LOCK_KEY
const env = (k) => { try { return Netlify.env.get(k); } catch { return undefined; } };
const API = () => (env("PADDLE_ENV") === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com");
const members = () => getStore({ name: "members", consistency: "strong" });
const index = () => getStore({ name: "paddle", consistency: "strong" });
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHA[b % ALPHA.length]).join("");
const GRACE = 3 * 24 * 3600 * 1000;

async function paddle(path) {
  const r = await fetch(API() + path, { headers: { Authorization: `Bearer ${env("PADDLE_API_KEY")}` } });
  if (!r.ok) throw new Error(`paddle ${r.status}`);
  return (await r.json()).data;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!env("PADDLE_API_KEY")) return json({ error: "not_configured" }, 500);
  let b = {};
  try { b = await req.json(); } catch {}
  const txnId = String(b.txn || "");
  if (!/^txn_[a-z0-9]+$/i.test(txnId)) return json({ error: "bad_txn" }, 400);

  // Already claimed? Return the same code (safe to retry / reload).
  const known = await index().get("txn:" + txnId, { type: "json" });
  if (known) return json({ code: known.code, name: known.name || "" });

  let t;
  try { t = await paddle(`/transactions/${txnId}`); } catch { return json({ error: "lookup_failed" }, 502); }
  if (!["paid", "completed"].includes(t.status)) return json({ error: "not_paid", status: t.status }, 409);

  let email = "", name = "";
  try { const c = await paddle(`/customers/${t.customer_id}`); email = c.email || ""; name = c.name || ""; } catch {}

  const s = members();
  let code;
  do { code = `TX-${part()}-${part()}`; } while (await s.get(code));
  const ends = t.billing_period && t.billing_period.ends_at ? Date.parse(t.billing_period.ends_at) : Date.now() + 31 * 24 * 3600 * 1000;
  const rec = {
    name: name || (email ? email.split("@")[0] : "Paddle member"),
    email,
    note: `Paddle ${t.subscription_id || txnId}`,
    created: Date.now(),
    expires: ends + GRACE,
    max: 2,
    devices: [],
    revoked: false,
    paddle: { sub: t.subscription_id || null, txn: txnId, customer: t.customer_id },
  };
  await s.setJSON(code, rec);
  await index().setJSON("txn:" + txnId, { code, name: rec.name });
  if (t.subscription_id) await index().setJSON("sub:" + t.subscription_id, { code });
  return json({ code, name: rec.name });
};

export const config = { path: "/api/claim" };
