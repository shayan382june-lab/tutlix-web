import { getStore } from "@netlify/blobs";

// Secrets live only on the server (this file is never sent to browsers).
// Set them in Netlify: Project configuration > Environment variables (LOCK_KEY, ADMIN_PASSWORD).
const env = (k) => { try { return Netlify.env.get(k); } catch { return undefined; } };
const MASTER_KEY = env("LOCK_KEY") || "";
const ADMIN_PASSWORD = env("ADMIN_PASSWORD") || "";

const store = () => getStore({ name: "members", consistency: "strong" });
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (c) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!MASTER_KEY) return json({ error: "network" }, 500);
  let body = {};
  try { body = await req.json(); } catch {}
  const code = clean(body.code);
  const device = String(body.device || "").slice(0, 80);
  if (!code || !device) return json({ error: "invalid" }, 400);

  const s = store();
  const rec = await s.get(code, { type: "json" });
  if (!rec) return json({ error: "invalid" }, 404);
  if (rec.revoked) return json({ error: "revoked" }, 403);
  if (rec.expires && Date.now() > rec.expires) return json({ error: "expired" }, 403);

  rec.devices = rec.devices || [];
  if (!rec.devices.includes(device)) {
    if (rec.devices.length >= (rec.max || 2)) return json({ error: "devices" }, 403);
    rec.devices.push(device);
  }
  rec.lastUsed = Date.now();
  await s.setJSON(code, rec);
  return json({ key: MASTER_KEY, name: (rec.name || "").split(" ")[0] });
};

export const config = { path: "/api/unlock" };
