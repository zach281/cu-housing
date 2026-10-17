// Milestone 2 end-to-end: create, photo, publish, manage a listing in a real
// browser against the local stack (real Auth + PostgREST + storage RLS).
//   1. bash e2e/stack/start.sh
//   2. Build and start the app on :3100 with the stack's URL and key
//   3. cd e2e && npm test
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";
import { APP_URL, createConfirmedUser } from "./helpers.mjs";

const FIXTURES = new URL("../fixtures/", import.meta.url).pathname;
const SHOTS = process.env.SCREENSHOT_DIR;
const STORAGE_DIR = process.env.STORAGE_DIR ?? "/var/tmp/cu-housing-stack/storage";
const db = new pg.Pool({ connectionString: process.env.STACK_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/stack" });

let browser, owner, other;
before(async () => {
  browser = await chromium.launch();
  owner = await createConfirmedUser({ name: "Owen Owner", intendedRole: "provider" });
  other = await createConfirmedUser({ name: "Nosy Neighbor" });
});
after(async () => {
  await browser?.close();
  await db.end();
});

async function signedInPage({ email, password }, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(`${APP_URL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/account/);
  return page;
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const filesFor = (listingId) => {
  const dir = path.join(STORAGE_DIR, "listing-images", owner.user.id, listingId);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.endsWith(".meta.json")) : [];
};


// Next.js keeps recently visited pages mounted but hidden (for instant back
// navigation), so the DOM can hold a hidden copy of the previous step's form.
// Always target the visible element.
const vis = (page, sel) => page.locator(sel).locator("visible=true").first();
const click = (page, sel) => vis(page, sel).click();
const fill = (page, sel, value) => vis(page, sel).fill(value);
const check = (page, sel) => vis(page, sel).check();
const uncheck = (page, sel) => vis(page, sel).uncheck();
const select = (page, sel, value) => vis(page, sel).selectOption(value);
const seen = (page, text, opts = {}) =>
  page.getByText(text, opts.exact ? { exact: true } : undefined).locator("visible=true").first().waitFor(opts.timeout ? { timeout: opts.timeout } : undefined);

let listingId;

test("signed-out visitors are sent to sign in", async () => {
  const page = await browser.newPage();
  await page.goto(`${APP_URL}/listings/new`);
  assert.match(page.url(), /\/login\?next=%2Flistings%2Fnew/);
  await page.close();
});

test("create a listing step by step", async () => {
  const page = await signedInPage(owner);

  // --- Basics: validation, then save -----------------------------------------
  await page.goto(`${APP_URL}/listings/new`);
  await click(page, "button[value=continue]");
  await seen(page, "Fix the 6 highlighted fields above.");
  await shot(page, "01-basics-errors");

  await check(page, "input[name=listing_type][value=sublease]");
  await select(page, "#property_type", "apartment");
  await fill(page, "#title", "Furnished room in a 3BR on the Hill");
  await fill(page, "#description", "Spring semester sublease. Furnished bedroom, two quiet roommates, 6 minute walk to Norlin.");
  await fill(page, "#bedrooms", "3");
  await fill(page, "#bathrooms", "1.5");
  await click(page, "button[value=continue]");
  await page.waitForURL(/\/dashboard\/listings\/[0-9a-f-]{36}\/edit\/pricing$/);
  listingId = page.url().match(/listings\/([0-9a-f-]{36})\//)[1];

  // --- Pricing ------------------------------------------------------------------
  await fill(page, "#monthly_rent", "12");
  await click(page, "button[value=continue]");
  await seen(page, /between \$100 and \$20,000/);
  await fill(page, "#monthly_rent", "$1,150");
  await check(page, "input[name=utilities_included]");
  await click(page, "button[value=continue]");
  await page.waitForURL(/edit\/location$/);

  // --- Location: lookup (may be unreachable in CI) then manual pin ---------------
  await click(page, "button[value=continue]");
  await seen(page, "Find the address on the map, or drop a pin.");
  await fill(page, "#address", "1135 13th St, Boulder, CO 80302");
  await click(page, "text=Find on map");
  await page.waitForFunction(() => /Found |isn't responding|couldn't find/.test(document.body.innerText));
  const found = await page.getByText(/^Found /).locator("visible=true").count();
  if (!found) {
    // Campus-centered map: click it to drop a pin.
    await vis(page, "[aria-label^='Map: click']").click({ position: { x: 300, y: 140 } });
  }
  await seen(page, /Pin placed [\d.]+ miles from Norlin Library/);
  await fill(page, "#neighborhood", "University Hill");
  await shot(page, "03-location");
  await click(page, "button[value=continue]");
  await page.waitForURL(/edit\/availability$/);

  // --- Availability: sublease needs an end date ---------------------------------
  await fill(page, "#available_date", "2027-01-05");
  await click(page, "button[value=continue]");
  await seen(page, "Add the date the lease ends.");
  await fill(page, "#lease_end_date", "2027-05-15");
  await click(page, "button[value=continue]");
  await page.waitForURL(/edit\/amenities$/);

  // --- Amenities --------------------------------------------------------------------
  await check(page, "input[name=furnished]");
  await click(page, "button[value=continue]");
  await page.waitForURL(/edit\/photos$/);

  // --- Photos: unreadable file, two good ones, reorder, remove -------------------------
  await page.locator("#photo-input").last().setInputFiles( path.join(FIXTURES, "broken.png"));
  await seen(page, "This file couldn't be read.");
  await page.locator("#photo-input").last().setInputFiles( [path.join(FIXTURES, "room-1.png"), path.join(FIXTURES, "room-2.png")]);
  await seen(page, "2 of 15 photos", { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll("ol img")].every((i) => i.complete && i.naturalWidth > 0));
  assert.equal(filesFor(listingId).length, 4, "full + thumbnail for each photo");
  const { rows: imgs } = await db.query("select storage_path from listing_images where listing_id = $1 order by display_order", [listingId]);
  const firstPath = imgs[0].storage_path;
  assert.match(firstPath, new RegExp(`^${owner.user.id}/${listingId}/[0-9a-f-]+\\.webp$`));
  const fullFile = path.join(STORAGE_DIR, "listing-images", firstPath);
  assert.ok(fs.statSync(fullFile).size < 200_000, "photo was compressed");
  assert.equal(fs.readFileSync(fullFile).subarray(8, 12).toString(), "WEBP");

  await click(page, "text=Make cover");
  await page.waitForFunction(() => !document.body.innerText.includes("Working…"));
  const { rows: reordered } = await db.query("select storage_path from listing_images where listing_id = $1 order by display_order", [listingId]);
  assert.notEqual(reordered[0].storage_path, firstPath, "second photo became the cover");
  await shot(page, "06-photos");

  await click(page, "button[aria-label='Remove photo 2']");
  await seen(page, "1 of 15 photos");
  await page.waitForFunction(() => !document.body.innerText.includes("Working…"));
  assert.equal(filesFor(listingId).length, 2, "removing a photo deletes its files from storage");

  // --- Review and publish ------------------------------------------------------------------
  await click(page, "text=Continue to review");
  await page.waitForURL(/edit\/review$/);
  await seen(page, "$1,150/mo");
  await shot(page, "07-review");
  await click(page, "text=Publish listing");
  await page.waitForURL(/\/dashboard\/listings\?published=/);
  await seen(page, "Your listing is live.");
  await seen(page, "Live", { exact: true });
  await shot(page, "08-my-listings");

  const { rows } = await db.query(
    `select l.status, l.published_at, l.monthly_rent, l.utilities_included, l.furnished, l.distance_from_campus_mi,
            l.lease_end_date::text, (select count(*) from analytics_events a where a.listing_id = l.id and a.event_name = 'listing_created')::int as created_events
       from listings l where id = $1`,
    [listingId],
  );
  assert.equal(rows[0].status, "active");
  assert.ok(rows[0].published_at);
  assert.equal(rows[0].monthly_rent, 1150);
  assert.equal(rows[0].utilities_included, true);
  assert.equal(rows[0].furnished, true);
  assert.equal(rows[0].lease_end_date, "2027-05-15");
  assert.ok(Number(rows[0].distance_from_campus_mi) < 3);
  assert.equal(rows[0].created_events, 1);
  await page.close();
});

test("manage status: unavailable, relist, and edits to a live listing", async () => {
  const page = await signedInPage(owner);
  await page.goto(`${APP_URL}/dashboard/listings`);
  await click(page, "text=Mark unavailable");
  await seen(page, "Unavailable", { exact: true });
  await click(page, "text=Relist");
  await seen(page, "Your listing is live.");

  await page.goto(`${APP_URL}/dashboard/listings/${listingId}/edit/pricing`);
  await fill(page, "#monthly_rent", "1100");
  await uncheck(page, "input[name=utilities_included]");
  await click(page, "button[value=exit]");
  await page.waitForURL(/\/dashboard\/listings\?saved=1/);
  const { rows } = await db.query("select status, monthly_rent, utilities_included from listings where id = $1", [listingId]);
  assert.deepEqual(rows[0], { status: "active", monthly_rent: 1100, utilities_included: false });

  const { rows: events } = await db.query("select count(*)::int as n from analytics_events where listing_id = $1 and event_name = 'listing_created'", [listingId]);
  assert.equal(events[0].n, 1, "relisting doesn't count as a new listing");
  await page.close();
});

test("drafts: save and exit, then delete", async () => {
  const page = await signedInPage(owner, { width: 390, height: 844 });
  await page.goto(`${APP_URL}/listings/new`);
  await check(page, "input[name=listing_type][value=room]");
  await select(page, "#property_type", "house");
  await fill(page, "#title", "Room in a house near Baseline");
  await fill(page, "#description", "Big room, shared kitchen, bike to campus in ten minutes or less.");
  await fill(page, "#bedrooms", "4");
  await fill(page, "#bathrooms", "2");
  await shot(page, "09-basics-mobile");
  await click(page, "button[value=exit]");
  await page.waitForURL(/\/dashboard\/listings\?saved=1/);
  await seen(page, "Room in a house near Baseline");
  await seen(page, /Next: Pricing\./);
  await shot(page, "10-my-listings-mobile");

  await click(page, "text=Delete draft");
  await click(page, "button:has-text('Delete'):not(:has-text('draft'))");
  await page.waitForURL(/deleted=1/);
  assert.equal(await page.getByText("Room in a house near Baseline").locator("visible=true").count(), 0);
  await page.close();
});

test("other users can't see or edit someone else's listing", async () => {
  const page = await signedInPage(other);
  // The page streams, so the HTTP status is 200; the not-found page renders instead of the form.
  await page.goto(`${APP_URL}/dashboard/listings/${listingId}/edit/basics`);
  await seen(page, "We couldn't find that page");
  assert.equal(await page.locator("#title").locator("visible=true").count(), 0);
  await page.goto(`${APP_URL}/dashboard/listings`);
  await seen(page, "You haven't listed anything yet");

  // Direct API attempts with the other user's session are blocked by RLS.
  const upd = await other.sb.from("listings").update({ monthly_rent: 1 }).eq("id", listingId).select("id");
  assert.equal(upd.data.length, 0);
  const img = await other.sb.from("listing_images").insert({ listing_id: listingId, storage_path: `${other.user.id}/x.webp` });
  assert.ok(img.error);
  await page.close();
});

test("publishing is blocked until every step is complete", async () => {
  const { data } = await owner.sb.from("listings").insert({ owner_id: owner.user.id, title: "Half finished" }).select("id").single();
  const page = await signedInPage(owner);
  await page.goto(`${APP_URL}/dashboard/listings/${data.id}/edit/review`);
  await seen(page, "Still needed before publishing");
  await click(page, "text=Publish listing");
  await seen(page, "Finish these steps before publishing.");
  const { rows } = await db.query("select status from listings where id = $1", [data.id]);
  assert.equal(rows[0].status, "draft");
  await page.close();
});
