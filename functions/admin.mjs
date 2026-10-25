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

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHA[b % ALPHA.length]).join("");
const MONTH = 31 * 24 * 3600 * 1000;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b = {};
  try { b = await req.json(); } catch {}
  if (!b.password || b.password !== ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "Wrong admin password" }, 401);
  }
  const s = store();
  const code = clean(b.code);

  switch (b.action) {
    case "login":
      return json({ ok: true });
    case "create": {
      let c;
      do { c = `TX-${part()}-${part()}`; } while (await s.get(c));
      const months = Math.max(0, Number(b.months) || 0);
      const rec = {
        name: String(b.name || "").slice(0, 80),
        email: String(b.email || "").slice(0, 120),
        note: String(b.note || "").slice(0, 200),
        created: Date.now(),
        expires: months ? Date.now() + months * MONTH : null,
        max: Math.min(5, Math.max(1, Number(b.max) || 2)),
        devices: [],
        revoked: false,
      };
      await s.setJSON(c, rec);
      return json({ code: c, ...rec });
    }
    case "list": {
      const { blobs } = await s.list();
      const out = [];
      for (const { key } of blobs) {
        const r = await s.get(key, { type: "json" });
        if (r) out.push({ code: key, ...r, devices: (r.devices || []).length });
      }
      out.sort((a, b2) => b2.created - a.created);
      return json({ members: out });
    }
    case "extend":
    case "revoke":
    case "restore":
    case "reset":
    case "delete": {
      const r = await s.get(code, { type: "json" });
      if (!r) return json({ error: "Code not found" }, 404);
      if (b.action === "delete") { await s.delete(code); return json({ ok: true }); }
      if (b.action === "revoke") r.revoked = true;
      if (b.action === "restore") r.revoked = false;
      if (b.action === "reset") r.devices = [];
      if (b.action === "extend") {
        const base = Math.max(Date.now(), r.expires || Date.now());
        r.expires = base + Math.max(1, Number(b.months) || 1) * MONTH;
        r.revoked = false;
      }
      await s.setJSON(code, r);
      return json({ ok: true });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
};

export const config = { path: "/api/admin" };
