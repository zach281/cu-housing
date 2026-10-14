import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/listings/new?step=2#photos")).toBe("/listings/new?step=2#photos");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["absolute URL", "https://evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["control characters", "/\n//evil.com"],
    ["relative path", "account"],
    ["non-string", 42],
    ["undefined", undefined],
    ["array (repeated query param)", ["/a", "/b"]],
  ])("rejects %s", (_label, input) => {
    expect(safeNextPath(input)).toBe("/account");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/")).toBe("/");
  });
});
