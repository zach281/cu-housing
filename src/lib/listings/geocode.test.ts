import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { geocode, parseCensusResponse, parseNominatimResponse, stripUnit, withDefaultCity } = await import("./geocode");

// Shape of a real response from geocoding.geo.census.gov (trimmed).
const censusHit = {
  result: {
    input: { address: { address: "1100 College Ave, Boulder, CO" } },
    addressMatches: [
      {
        matchedAddress: "1100 COLLEGE AVE, BOULDER, CO, 80302",
        coordinates: { x: -105.27735, y: 40.00429 },
        tigerLine: { side: "L", tigerLineId: "123" },
      },
    ],
  },
};

const respond = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("withDefaultCity", () => {
  it.each([
    ["1100 College Ave", "1100 College Ave, Boulder, CO"],
    ["1100 College Ave, Boulder, CO", "1100 College Ave, Boulder, CO"],
    ["600 S Public Rd, Lafayette, Colorado", "600 S Public Rd, Lafayette, Colorado"],
    ["1100 College Ave 80302", "1100 College Ave 80302"],
  ])("%j → %j", (input, expected) => {
    expect(withDefaultCity(input)).toBe(expected);
  });
});

describe("parseCensusResponse", () => {
  it("reads x as longitude and y as latitude", () => {
    expect(parseCensusResponse(censusHit)).toEqual({ lat: 40.00429, lng: -105.27735, matchedAddress: "1100 COLLEGE AVE, BOULDER, CO, 80302" });
  });
  it.each([{}, { result: { addressMatches: [] } }, { result: { addressMatches: [{ coordinates: {} }] } }, null])(
    "returns null for %j",
    (body) => expect(parseCensusResponse(body)).toBeNull(),
  );
});

describe("geocode", () => {
  it("returns coordinates and distance for a Boulder address", async () => {
    const fetchImpl = respond(censusHit);
    const r = await geocode("1100 College Ave", fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, lat: 40.00429, lng: -105.27735 });
    expect(r.ok && r.miles).toBeLessThan(1);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("address")).toBe("1100 College Ave, Boulder, CO");
    expect(url.searchParams.get("format")).toBe("json");
  });

  it("rejects addresses far from campus", async () => {
    const far = { result: { addressMatches: [{ matchedAddress: "X", coordinates: { x: -87.63, y: 41.88 } }] } };
    expect(await geocode("233 S Wacker Dr, Chicago, IL", respond(far) as unknown as typeof fetch)).toMatchObject({ ok: false, reason: "too_far" });
  });

  it("reports not found, server errors, and network failures distinctly", async () => {
    expect(await geocode("nowhere", respond({ result: { addressMatches: [] } }) as unknown as typeof fetch)).toEqual({ ok: false, reason: "not_found" });
    expect(await geocode("x st", respond({}, false) as unknown as typeof fetch)).toEqual({ ok: false, reason: "unavailable" });
    const boom = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await geocode("x st", boom as unknown as typeof fetch)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("stripUnit", () => {
  it.each([
    ["1100 College Ave Apt 3, Boulder, CO", "1100 College Ave, Boulder, CO"],
    ["1100 College Ave, Apt. 3B", "1100 College Ave"],
    ["900 28th St #204", "900 28th St"],
    ["900 28th St Unit B, Boulder", "900 28th St, Boulder"],
    ["2500 Baseline Rd Suite 10", "2500 Baseline Rd"],
    ["1135 13th St, Boulder, CO 80302", "1135 13th St, Boulder, CO 80302"],
  ])("%j → %j", (input, expected) => {
    expect(stripUnit(input)).toBe(expected);
  });
});

describe("geocode fallback to OpenStreetMap", () => {
  const osmHit = [{ lat: "40.0082", lon: "-105.2763", display_name: "1135, 13th Street, Boulder, Colorado" }];
  const byHost = (census: () => Response, osm: () => Response) =>
    vi.fn(async (url: URL | string) => (String(url).includes("census.gov") ? census() : osm()));
  const ok = (body: unknown) => () => ({ ok: true, json: async () => body }) as Response;
  const down = () => ({ ok: false, json: async () => ({}) }) as Response;

  it("uses OSM when Census is down", async () => {
    const f = byHost(down, ok(osmHit));
    expect(await geocode("1135 13th St", f as unknown as typeof fetch)).toMatchObject({ ok: true, source: "osm", lat: 40.0082 });
  });

  it("uses OSM when Census has no match", async () => {
    const f = byHost(ok({ result: { addressMatches: [] } }), ok(osmHit));
    expect(await geocode("1135 13th St", f as unknown as typeof fetch)).toMatchObject({ ok: true, source: "osm" });
  });

  it("doesn't call OSM when Census matches", async () => {
    const f = byHost(ok(censusHit), ok(osmHit));
    expect(await geocode("1100 College Ave", f as unknown as typeof fetch)).toMatchObject({ ok: true, source: "census" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("strips the unit and identifies the app to OSM", async () => {
    const f = byHost(down, ok(osmHit));
    await geocode("1135 13th St Apt 4", f as unknown as typeof fetch);
    const [osmUrl, init] = f.mock.calls[1] as unknown as [URL, RequestInit];
    expect(new URL(String(osmUrl)).searchParams.get("q")).toBe("1135 13th St, Boulder, CO");
    expect((init.headers as Record<string, string>)["user-agent"]).toMatch(/^CampusNest\/1\.0/);
  });

  it("parses OSM results defensively", () => {
    expect(parseNominatimResponse([])).toBeNull();
    expect(parseNominatimResponse([{ lat: "x", lon: "1" }])).toBeNull();
    expect(parseNominatimResponse(osmHit)).toEqual({ lat: 40.0082, lng: -105.2763, matchedAddress: osmHit[0].display_name });
  });
});
