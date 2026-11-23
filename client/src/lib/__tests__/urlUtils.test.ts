import { describe, it, expect } from "vitest";
import { sanitizeRedirectUrl } from "../urlUtils.js";

describe("sanitizeRedirectUrl", () => {
  it("allows safe internal relative paths", () => {
    expect(sanitizeRedirectUrl("/")).toBe("/");
    expect(sanitizeRedirectUrl("/d/123-abc")).toBe("/d/123-abc");
    expect(sanitizeRedirectUrl("/dashboard?filter=recent")).toBe("/dashboard?filter=recent");
    expect(sanitizeRedirectUrl("/settings#profile")).toBe("/settings#profile");
  });

  it("rejects null, undefined, empty, and non-slash strings", () => {
    expect(sanitizeRedirectUrl(null)).toBe("/");
    expect(sanitizeRedirectUrl(undefined)).toBe("/");
    expect(sanitizeRedirectUrl("")).toBe("/");
    expect(sanitizeRedirectUrl("   ")).toBe("/");
    expect(sanitizeRedirectUrl("dashboard")).toBe("/");
    expect(sanitizeRedirectUrl("d/123")).toBe("/");
  });

  it("rejects protocol-relative open redirects", () => {
    expect(sanitizeRedirectUrl("//evil.com")).toBe("/");
    expect(sanitizeRedirectUrl("//evil.com/phishing")).toBe("/");
    expect(sanitizeRedirectUrl("///evil.com")).toBe("/");
  });

  it("rejects backslash-based evasion redirects", () => {
    expect(sanitizeRedirectUrl("/\\evil.com")).toBe("/");
    expect(sanitizeRedirectUrl("/\\\\evil.com")).toBe("/");
    expect(sanitizeRedirectUrl("\\evil.com")).toBe("/");
  });

  it("rejects URLs with schemes", () => {
    expect(sanitizeRedirectUrl("https://evil.com")).toBe("/");
    expect(sanitizeRedirectUrl("http://evil.com/login")).toBe("/");
    expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("/");
    expect(sanitizeRedirectUrl("data:text/html,evil")).toBe("/");
  });

  it("uses custom fallback if provided", () => {
    expect(sanitizeRedirectUrl("//evil.com", "/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectUrl(null, "/custom")).toBe("/custom");
  });
});
