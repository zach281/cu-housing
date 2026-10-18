// Adds placeholder pictures to the development seed listings in the LOCAL test
// stack (illustrations, not photos). Signs in as each demo owner, so uploads go
// through the same storage and database permissions as real users.
//   node e2e/seed-photos.mjs
import zlib from "node:zlib";
import { createClient, SUPABASE_URL, PUBLISHABLE_KEY } from "./tests/helpers.mjs";

const PASSWORD = "demo-password-1";
const OWNER_EMAILS = ["01", "02", "03", "04", "05"].map((s) => `owner${s}@demo.campusnest.invalid`);

// Small PNG encoder (RGB, no dependencies).
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x / width, y / height);
      raw.writeUInt8(r, row + 1 + x * 3);
      raw.writeUInt8(g, row + 2 + x * 3);
      raw.writeUInt8(b, row + 3 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "binary"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const PALETTES = [
  { sky: [[180, 210, 230], [235, 240, 238]], wall: [214, 196, 170], roof: [96, 72, 60], ground: [92, 128, 84] },
  { sky: [[236, 196, 150], [246, 230, 205]], wall: [190, 120, 96], roof: [70, 52, 48], ground: [120, 140, 90] },
  { sky: [[150, 190, 215], [220, 232, 240]], wall: [236, 236, 228], roof: [45, 66, 80], ground: [80, 110, 80] },
  { sky: [[205, 215, 225], [240, 242, 244]], wall: [120, 140, 150], roof: [40, 44, 50], ground: [140, 150, 120] },
];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Simple illustrated house: sky gradient, mountains, house, lawn. */
function illustration(seed, w, h) {
  const p = PALETTES[seed % PALETTES.length];
  const hx = 0.28 + (seed % 3) * 0.08;
  return png(w, h, (x, y) => {
    const ridge = 0.42 - 0.12 * Math.abs(Math.sin(x * 6 + seed));
    if (y > 0.82) return p.ground;
    if (x > hx && x < hx + 0.42 && y > 0.5) {
      const winX = ((x - hx) * 10) % 1, winY = ((y - 0.5) * 12) % 1;
      return winX > 0.3 && winX < 0.7 && winY > 0.25 && winY < 0.75 && y < 0.78 ? [250, 236, 180] : p.wall;
    }
    const roofTop = 0.32, roofBase = 0.5, cx = hx + 0.21;
    if (y >= roofTop && y <= roofBase && Math.abs(x - cx) <= ((y - roofTop) / (roofBase - roofTop)) * 0.25) return p.roof;
    if (y > ridge && y < 0.82) return mix([110, 125, 120], [150, 160, 150], (y - ridge) / 0.4);
    return mix(p.sky[0], p.sky[1], y);
  });
}

let added = 0;
for (const [i, email] of OWNER_EMAILS.entries()) {
  const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  const { data: listings } = await sb.from("listings").select("id, listing_images(id)").eq("owner_id", auth.user.id);
  for (const [j, l] of listings.entries()) {
    if (l.listing_images.length) continue;
    const count = 1 + ((i + j) % 3);
    for (let k = 0; k < count; k++) {
      const seed = i * 7 + j * 3 + k;
      const path = `${auth.user.id}/${l.id}/seed-${k}.png`;
      const up = await sb.storage.from("listing-images").upload(path, new Blob([illustration(seed, 960, 720)], { type: "image/png" }), { upsert: false });
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
      await sb.storage.from("listing-images").upload(path.replace(/\.png$/, "-thumb.png"), new Blob([illustration(seed, 480, 360)], { type: "image/png" }));
      const ins = await sb.from("listing_images").insert({ listing_id: l.id, storage_path: path, display_order: k });
      if (ins.error) throw new Error(`Image row failed: ${ins.error.message}`);
      added++;
    }
  }
}
console.log(`Seed photos: added ${added} placeholder pictures.`);
