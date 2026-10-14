import { describe, expect, it } from "vitest";
import { signUpSchema, updatePasswordSchema } from "./auth";
import { isUniversityEmail } from "@/lib/site";

const valid = { name: "Ralphie B", email: "Ralphie@Colorado.edu ", password: "buffs2027", intendedRole: "student" };

describe("signUpSchema", () => {
  it("accepts a valid sign-up and normalizes the email", () => {
    const r = signUpSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("ralphie@colorado.edu");
  });

  it.each([
    ["short password", { password: "ab1" }],
    ["password without numbers", { password: "onlyletters" }],
    ["password without letters", { password: "12345678" }],
    ["bad email", { email: "not-an-email" }],
    ["blank name", { name: "   " }],
    ["self-assigned admin", { intendedRole: "admin" }],
  ])("rejects %s", (_label, patch) => {
    expect(signUpSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = updatePasswordSchema.safeParse({ password: "newpass123", confirm: "newpass124" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });
});

describe("isUniversityEmail", () => {
  it("matches only the exact CU domain", () => {
    expect(isUniversityEmail("a@colorado.edu")).toBe(true);
    expect(isUniversityEmail("A@COLORADO.EDU")).toBe(true);
    expect(isUniversityEmail("a@cs.colorado.edu")).toBe(false);
    expect(isUniversityEmail("a@colorado.edu.evil.com")).toBe(false);
    expect(isUniversityEmail("a@notcolorado.edu")).toBe(false);
  });
});
