import { describe, expect, it } from "vitest";
import { cacheControlForStaticPath } from "./staticCachePolicy";

describe("release-pointer static cache policy", () => {
  it("requires fresh validation for the application shell and service worker", () => {
    expect(cacheControlForStaticPath("/app/dist/public/index.html")).toBe(
      "no-cache, must-revalidate"
    );
    expect(cacheControlForStaticPath("/app/dist/public/sw.js")).toBe(
      "no-cache, must-revalidate"
    );
    expect(cacheControlForStaticPath("/app/dist/public/sw-v8.js")).toBe(
      "no-cache, must-revalidate"
    );
  });

  it("does not misclassify content-addressed assets as release pointers", () => {
    expect(
      cacheControlForStaticPath("/app/dist/public/assets/index-ABC123.js")
    ).toBeUndefined();
    expect(
      cacheControlForStaticPath("/app/dist/public/icons/icon-192.png")
    ).toBeUndefined();
  });
});
