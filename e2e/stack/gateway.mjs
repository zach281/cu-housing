// Local stand-in for the Supabase API gateway (TEST ONLY).
//
//   /auth/v1/*     → Supabase Auth server (real binary)
//   /rest/v1/*     → PostgREST (real binary)
//   /storage/v1/*  → emulated here, but every write goes through the real
//                    storage.objects Row Level Security policies, running as
//                    the calling user, the way Supabase Storage does.
//
// Like the real gateway it rejects requests whose apikey doesn't match, and
// turns the publishable key into an anon JWT for the services behind it.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH_URL = process.env.AUTH_URL ?? "http://127.0.0.1:9999";
const REST_URL = process.env.REST_URL ?? "http://127.0.0.1:54330";
const JWT_SECRET = process.env.JWT_SECRET;
const PUBLISHABLE_KEY = process.env.PUBLISHABLE_KEY;
const STORAGE_DIR = process.env.STORAGE_DIR;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (!JWT_SECRET || !PUBLISHABLE_KEY || !STORAGE_DIR) throw new Error("JWT_SECRET, PUBLISHABLE_KEY, STORAGE_DIR required");

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function signJwt(payload) {
  const head = b64url({ alg: "HS256", typ: "JWT" });
  const body = b64url(payload);
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, p, s] = token.split(".");
  if (!s) return null;
  const expect = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  if (expect.length !== s.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}
const ANON_JWT = signJwt({ role: "anon", iss: "test-stack", iat: 1700000000, exp: 4100000000 });

const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function proxy(req, res, target, bearer) {
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
  const headers = { ...req.headers, authorization: `Bearer ${bearer}` };
  delete headers.host;
  delete headers["content-length"];
  const r = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
  const out = {};
  r.headers.forEach((v, k) => {
    if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) out[k] = v;
  });
  res.writeHead(r.status, out);
  res.end(Buffer.from(await r.arrayBuffer()));
}

// Run SQL as the calling user with RLS, the way Supabase Storage does.
async function asUser(claims, fn) {
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query(`set local role ${claims.role === "authenticated" ? "authenticated" : "anon"}`);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const safePath = (bucket, name) => {
  const p = path.resolve(STORAGE_DIR, bucket, name);
  if (!p.startsWith(path.resolve(STORAGE_DIR) + path.sep)) throw new Error("bad path");
  return p;
};

async function storage(req, res, url, claims) {
  const parts = url.pathname.replace(/^\/storage\/v1\//, "").split("/").map(decodeURIComponent);

  // Public file download: no RLS for public buckets.
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "public") {
    const [bucket, ...rest] = parts.slice(2);
    const { rows } = await db.query("select public from storage.buckets where id = $1", [bucket]);
    if (!rows[0]?.public) return json(res, 400, { statusCode: "404", error: "not_found", message: "Bucket not found" });
    try {
      const file = await fs.readFile(safePath(bucket, rest.join("/")));
      const meta = JSON.parse(await fs.readFile(safePath(bucket, rest.join("/")) + ".meta.json", "utf8"));
      res.writeHead(200, { "content-type": meta.contentType, "cache-control": "max-age=3600" });
      return res.end(file);
    } catch {
      return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    }
  }

  // Upload: POST /object/<bucket>/<path>
  if ((req.method === "POST" || req.method === "PUT") && parts[0] === "object") {
    const [bucket, ...rest] = parts.slice(1);
    const name = rest.join("/");
    const webReq = new Request(`http://x${req.url}`, { method: "POST", headers: req.headers, body: await readBody(req) });
    let blob;
    const ct = req.headers["content-type"] ?? "";
    if (ct.startsWith("multipart/form-data")) {
      const form = await webReq.formData();
      for (const [, v] of form) if (typeof v !== "string") blob = v;
    } else {
      blob = new Blob([await webReq.arrayBuffer()], { type: ct });
    }
    if (!blob) return json(res, 400, { statusCode: "400", error: "invalid", message: "No file" });

    const { rows } = await db.query("select * from storage.buckets where id = $1", [bucket]);
    const b = rows[0];
    if (!b) return json(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
    if (b.file_size_limit && blob.size > Number(b.file_size_limit))
      return json(res, 413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
    if (b.allowed_mime_types && !b.allowed_mime_types.includes(blob.type))
      return json(res, 415, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${blob.type} is not supported` });

    try {
      await asUser(claims, (c) =>
        c.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [bucket, name, claims.sub ?? null]),
      );
    } catch (e) {
      if (e.code === "42501") return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (e.code === "23505") return json(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      throw e;
    }
    const file = safePath(bucket, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.from(await blob.arrayBuffer()));
    await fs.writeFile(file + ".meta.json", JSON.stringify({ contentType: blob.type }));
    return json(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
  }

  // Remove: DELETE /object/<bucket> {prefixes: [...]}. Like Supabase, needs
  // both SELECT and DELETE permission on the objects.
  if (req.method === "DELETE" && parts[0] === "object" && parts.length === 2) {
    const bucket = parts[1];
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    const deleted = await asUser(claims, async (c) => {
      const r = await c.query("delete from storage.objects where bucket_id = $1 and name = any($2) returning name", [bucket, prefixes]);
      return r.rows.map((x) => x.name);
    });
    for (const name of deleted) {
      await fs.rm(safePath(bucket, name), { force: true });
      await fs.rm(safePath(bucket, name) + ".meta.json", { force: true });
    }
    return json(res, 200, deleted.map((name) => ({ name, bucket_id: bucket })));
  }

  return json(res, 400, { statusCode: "400", error: "not_implemented", message: `${req.method} ${url.pathname} not emulated` });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      });
      return res.end();
    }
    try {
      // Like Supabase: public files and links opened from emails need no key.
      const keyless =
        url.pathname.startsWith("/storage/v1/object/public/") ||
        ["/auth/v1/verify", "/auth/v1/callback", "/auth/v1/authorize"].includes(url.pathname);
      const apikey = req.headers.apikey ?? url.searchParams.get("apikey");
      if (!keyless && apikey !== PUBLISHABLE_KEY) return json(res, 401, { message: "Invalid API key" });

      const auth = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const userClaims = auth.split(".").length === 3 ? verifyJwt(auth) : null;
      if (auth.split(".").length === 3 && !userClaims && !url.pathname.startsWith("/auth/v1/"))
        return json(res, 401, { code: "PGRST301", message: "JWT expired or invalid" });
      const bearer = userClaims ? auth : ANON_JWT;
      const claims = userClaims ?? { role: "anon" };

      if (url.pathname.startsWith("/auth/v1/")) return await proxy(req, res, AUTH_URL + url.pathname.slice(8) + url.search, bearer);
      if (url.pathname.startsWith("/rest/v1/")) return await proxy(req, res, REST_URL + url.pathname.slice(8) + url.search, bearer);
      if (url.pathname.startsWith("/storage/v1/")) return await storage(req, res, url, claims);
      json(res, 404, { message: "no route" });
    } catch (e) {
      console.error(e);
      json(res, 500, { message: String(e?.message ?? e) });
    }
  })
  .listen(PORT, () => console.log(`gateway on :${PORT}`));
