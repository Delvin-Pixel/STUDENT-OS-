import { describe, expect, it } from "vitest";
import { resolveAnalyticsScriptConfig } from "./analytics";

describe("optional analytics configuration", () => {
  it("omits analytics cleanly when either build-time setting is absent", () => {
    expect(resolveAnalyticsScriptConfig(undefined, "site-1")).toBeNull();
    expect(
      resolveAnalyticsScriptConfig("https://analytics.example", "")
    ).toBeNull();
  });

  it("rejects malformed and non-HTTPS analytics endpoints", () => {
    expect(
      resolveAnalyticsScriptConfig("%VITE_ANALYTICS_ENDPOINT%", "site-1")
    ).toBeNull();
    expect(
      resolveAnalyticsScriptConfig("http://analytics.example", "site-1")
    ).toBeNull();
    expect(resolveAnalyticsScriptConfig("not a url", "site-1")).toBeNull();
  });

  it("constructs the analytics script only from a valid HTTPS endpoint and website identifier", () => {
    expect(
      resolveAnalyticsScriptConfig(
        "https://analytics.example/collect",
        "site-1"
      )
    ).toEqual({
      src: "https://analytics.example/collect/umami",
      websiteId: "site-1",
    });
  });
});
