import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getSiteUrl } = await import("./site-url");

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("prefers an explicit SITE_URL and trims trailing slashes", () => {
    vi.stubEnv("SITE_URL", "https://nest.example.com/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "cu-housing.vercel.app");
    expect(getSiteUrl()).toBe("https://nest.example.com");
  });

  it("uses Vercel's production domain automatically", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "cu-housing.vercel.app");
    expect(getSiteUrl()).toBe("https://cu-housing.vercel.app");
  });

  it("falls back to localhost for local development", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
