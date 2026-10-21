import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CapabilityState } from "@shared/capabilityAccess";
const mock = vi.hoisted(() => ({ state: "locked" as CapabilityState }));
vi.mock("@/contexts/EntitlementContext", () => ({
  useCapability: () => ({ state: mock.state, reason: "premium_required" }),
}));
import { FeatureGate } from "./FeatureGate";
describe("FeatureGate rendering", () => {
  it.each([
    "loading",
    "locked",
    "offline_unverified",
    "error_fallback",
  ] as const)("does not render protected content when %s", state => {
    mock.state = state;
    const html = renderToStaticMarkup(
      <FeatureGate feature="advanced_reports">
        <button>Protected action</button>
      </FeatureGate>
    );
    expect(html).not.toContain("Protected action");
    expect(html).toContain('role="status"');
    expect(html).toContain(`data-capability-state="${state}"`);
    expect(html).not.toContain("checkout");
  });
  it("renders children only when allowed", () => {
    mock.state = "allowed";
    expect(
      renderToStaticMarkup(
        <FeatureGate feature="advanced_reports">
          <button>Protected action</button>
        </FeatureGate>
      )
    ).toContain("Protected action");
  });
});
