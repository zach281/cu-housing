// Milestone 3 end-to-end: browse, search, filters, sort, map, pagination, and
// public location privacy. Expected results are computed with independent SQL
// against the same database, then compared with what the page shows.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";
import { APP_URL, client, createClient, SUPABASE_URL, PUBLISHABLE_KEY } from "./helpers.mjs";

const SHOTS = process.env.SCREENSHOT_DIR;
const db = new pg.Pool({ connectionString: process.env.STACK_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/stack" });
const count = async (where = "true", params = []) =>
  (await db.query(`select count(*)::int as n from listings where status = 'active' and (${where})`, params)).rows[0].n;

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await db.end();
});

const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const shownCount = async (page) => Number((await page.locator("[aria-live=polite]").first().innerText()).replace(/[^\d]/g, ""));
async function settle(page) {
  await page.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  await page.waitForLoadState("networkidle");
}
async function expectCount(page, expected, label) {
  await page.waitForFunction(
    (n) => Number(document.querySelector("[aria-live=polite]")?.textContent?.replace(/[^\d]/g, "")) === n && !document.querySelector("[aria-busy=true]"),
    expected,
    { timeout: 15000 },
  ).catch(async () => assert.fail(`${label}: expected ${expected}, page shows ${await shownCount(page)}`));
}

test("signed-out visitors see active listings, never exact addresses", async () => {
  const page = await browser.newPage();
  await page.goto(`${APP_URL}/browse`);
  const total = await count();
  assert.ok(total >= 24, "seed listings loaded");
  await expectCount(page, total, "all active");
  const html = await page.content();
  const { rows } = await db.query("select address from listings where status = 'active'");
  for (const { address } of rows) {
    const street = address.split(",")[0];
    assert.ok(!html.includes(street), `street address leaked into the page: ${street}`);
  }
  await page.close();
});

test("the API refuses exact locations to signed-out visitors", async () => {
  const anon = client();
  const { error } = await anon.from("listings").select("address").limit(1);
  assert.match(error?.message ?? "", /permission denied/);
  const ok = await anon.from("listings").select("id, approx_latitude, neighborhood").limit(1);
  assert.equal(ok.error, null);
});

test("filters match the database and live in the URL", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP_URL}/browse`);
  await settle(page);

  await page.fill("#browse-q", "furnished");
  await page.waitForURL(/q=furnished/);
  await expectCount(page, await count("search_vector @@ websearch_to_tsquery('english', 'furnished')"), "keyword");

  await page.fill("#browse-q", "");
  await page.fill("[aria-label='Minimum rent']", "900");
  await page.fill("[aria-label='Maximum rent']", "1,500");
  await page.waitForURL(/min_price=900.*max_price=1500/);
  await expectCount(page, await count("monthly_rent between 900 and 1500"), "price range");

  await page.locator("#filters-panel label:has-text('Sublease')").click();
  await page.waitForURL(/type=sublease/);
  await expectCount(page, await count("monthly_rent between 900 and 1500 and listing_type = 'sublease'"), "price + sublease");

  await page.locator("#filters-panel label:has-text('Furnished')").click();
  await page.waitForURL(/furnished=1/);
  await expectCount(page, await count("monthly_rent between 900 and 1500 and listing_type = 'sublease' and furnished"), "price + sublease + furnished");
  await shot(page, "browse-filters");

  // Back button restores the previous filter set.
  await page.goBack();
  await page.waitForURL((u) => !u.search.includes("furnished"));
  await expectCount(page, await count("monthly_rent between 900 and 1500 and listing_type = 'sublease'"), "after back");

  await page.click("text=Clear all filters");
  await page.waitForURL(`${APP_URL}/browse`);
  await expectCount(page, await count(), "cleared");

  await page.selectOption("[aria-label='Distance from campus']", "1");
  await expectCount(page, await count("distance_from_campus_mi <= 1"), "within 1 mile");

  await page.selectOption("[aria-label='Distance from campus']", "");
  await page.selectOption("[aria-label='Minimum bedrooms']", "2");
  await page.selectOption("[aria-label='Maximum bedrooms']", "3");
  await expectCount(page, await count("bedrooms between 2 and 3"), "2-3 beds");

  await page.selectOption("[aria-label='Minimum bedrooms']", "");
  await page.selectOption("[aria-label='Maximum bedrooms']", "0");
  await expectCount(page, await count("bedrooms = 0"), "studios");

  await page.selectOption("[aria-label='Maximum bedrooms']", "");
  const moveIn = (await db.query("select (current_date + 30)::text as d")).rows[0].d;
  await page.fill("[aria-label='Move-in date']", moveIn);
  await expectCount(page, await count("available_date <= $1 and (lease_end_date is null or lease_end_date > $1)", [moveIn]), "move in by");
  await page.close();
});

test("sorting by price and distance", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP_URL}/browse?sort=price_asc`);
  await settle(page);
  const firstRent = async () => Number((await page.locator("article p").first().innerText()).replace(/[^\d]/g, ""));
  const { rows: [{ min, max }] } = await db.query("select min(monthly_rent) as min, max(monthly_rent) as max from listings where status = 'active'");
  assert.equal(await firstRent(), min);
  await page.selectOption("#browse-sort", "price_desc");
  await page.waitForURL(/sort=price_desc/);
  await settle(page);
  assert.equal(await firstRent(), max);
  await page.selectOption("#browse-sort", "distance");
  await page.waitForURL(/sort=distance/);
  await settle(page);
  const { rows: [closest] } = await db.query("select title from listings where status = 'active' order by distance_from_campus_mi asc nulls last, id limit 1");
  assert.equal(await page.locator("article h3").first().innerText(), closest.title);
  await page.close();
});

test("drafts and unavailable listings never appear", async () => {
  const owner = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: auth } = await owner.auth.signInWithPassword({ email: "owner02@demo.campusnest.invalid", password: "demo-password-1" });
  const { data: mine } = await owner.from("listings").select("id, title").eq("owner_id", auth.user.id).eq("status", "active").limit(1).single();
  const upd = await owner.from("listings").update({ status: "unavailable" }).eq("id", mine.id).select("id");
  assert.equal(upd.data.length, 1, "owner can mark own listing unavailable");
  const { data: draft } = await owner.from("listings").insert({ owner_id: auth.user.id, title: "Secret unfinished draft" }).select("id").single();

  const page = await browser.newPage();
  await page.goto(`${APP_URL}/browse?q=${encodeURIComponent(mine.title.split(" ")[0])}`);
  await settle(page);
  const html = await page.content();
  assert.ok(!html.includes(mine.title), "unavailable listing hidden");
  await page.goto(`${APP_URL}/browse?q=secret`);
  await settle(page);
  assert.ok(!(await page.content()).includes("Secret unfinished draft"), "draft hidden");

  await owner.from("listings").update({ status: "active" }).eq("id", mine.id);
  await owner.from("listings").delete().eq("id", draft.id);
  await page.close();
});

test("pagination when there are more than 24 results", async () => {
  // Add a listing so there are at least 25.
  const owner = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: auth } = await owner.auth.signInWithPassword({ email: "owner05@demo.campusnest.invalid", password: "demo-password-1" });
  const { error } = await owner.from("listings").insert({
    owner_id: auth.user.id, title: "Pagination test cottage", description: "Small cottage used by the pagination test. Not real.",
    property_type: "house", listing_type: "lease", monthly_rent: 1999, bedrooms: 1, bathrooms: 1,
    available_date: new Date(Date.now() + 864e5 * 30).toISOString().slice(0, 10), address: "1 Test Ln, Boulder, CO",
    latitude: 40.01, longitude: -105.27, status: "active",
  });
  assert.equal(error, null);

  const total = await count();
  const page = await browser.newPage();
  await page.goto(`${APP_URL}/browse`);
  await settle(page);
  assert.equal(await page.locator("article").count(), 24);
  await page.click("nav[aria-label=Pages] >> text=Next");
  await page.waitForURL(/page=2/);
  await settle(page);
  assert.equal(await page.locator("article").count(), Math.min(24, total - 24));
  await page.getByText(`25–${Math.min(48, total)} of ${total}`).waitFor();
  await page.close();
});

test("map view shows a pin for every match", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP_URL}/browse?type=room`);
  await settle(page);
  await page.click("button[aria-pressed]:has-text('Map')");
  await page.waitForURL(/view=map/);
  await page.waitForSelector(".leaflet-marker-icon");
  const expected = await count("listing_type = 'room' and approx_latitude is not null");
  // +1 for the "CU campus" label marker
  await page.waitForFunction((n) => document.querySelectorAll(".leaflet-marker-icon").length === n, expected + 1);
  await shot(page, "browse-map-rooms");
  await page.close();
});

test("phone: filter sheet opens, applies, and closes", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${APP_URL}/browse`);
  await settle(page);
  assert.equal(await page.locator("#filters-panel").isVisible(), false);
  await page.click("button[aria-controls=filters-panel]");
  await page.locator("#filters-panel").waitFor({ state: "visible" });
  await page.locator("#filters-panel label:has-text('Pets allowed')").click();
  await page.waitForURL(/pets=1/);
  const expected = await count("pets_allowed");
  await page.getByRole("button", { name: `Show ${expected} places` }).waitFor({ timeout: 15000 });
  await shot(page, "browse-mobile-sheet");
  await page.getByRole("button", { name: `Show ${expected} places` }).click();
  await page.locator("#filters-panel").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Filters (1)" }).waitFor();
  await page.close();
});

test("searches are recorded for analytics", async () => {
  const before = (await db.query("select count(*)::int as n from analytics_events where event_name = 'search_performed'")).rows[0].n;
  const page = await browser.newPage();
  await page.goto(`${APP_URL}/browse`);
  await settle(page);
  await page.fill("#browse-q", "quiet");
  await page.waitForURL(/q=quiet/);
  await page.waitForTimeout(2500);
  const { rows } = await db.query("select properties from analytics_events where event_name = 'search_performed' order by id desc limit 1");
  const after = (await db.query("select count(*)::int as n from analytics_events where event_name = 'search_performed'")).rows[0].n;
  assert.ok(after > before);
  assert.equal(rows[0].properties.has_query, true);
  assert.ok(!JSON.stringify(rows[0].properties).includes("quiet"), "search text itself isn't stored");
  await page.close();
});
