import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveEntitlementSnapshot } from "@shared/entitlements";
const mocks = vi.hoisted(() => ({
  response: {} as {
    data?: { accountId: string; snapshot: unknown };
    isPending: boolean;
    isFetching: boolean;
    isError: boolean;
  },
  keys: [] as unknown[],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown }) => {
    mocks.keys.push(options.queryKey);
    return mocks.response;
  },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ client: { entitlements: { me: { query: vi.fn() } } } }),
  },
}));
import { EntitlementProvider, useCapability } from "./EntitlementContext";
function Consumer() {
  return <span>{useCapability("advanced_reports").state}</span>;
}
describe("account-scoped entitlement provider", () => {
  it("uses distinct account query keys and rejects late results from a former account", () => {
    vi.stubGlobal("navigator", { onLine: true });
    mocks.response = {
      data: {
        accountId: "a",
        snapshot: resolveEntitlementSnapshot({
          plan: "premium",
          provider: "manual",
          status: "active",
        }),
      },
      isPending: false,
      isFetching: false,
      isError: false,
    };
    expect(
      renderToStaticMarkup(
        <EntitlementProvider accountId="a">
          <Consumer />
        </EntitlementProvider>
      )
    ).toContain("allowed");
    expect(
      renderToStaticMarkup(
        <EntitlementProvider accountId="b">
          <Consumer />
        </EntitlementProvider>
      )
    ).toContain("error_fallback");
    expect(mocks.keys).toEqual([
      ["account-capabilities", "a"],
      ["account-capabilities", "b"],
    ]);
    vi.unstubAllGlobals();
  });
});
