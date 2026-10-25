import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { clearAccountQueries } from "./clearAccountQueries";

describe("logout query isolation", () => {
  it("evicts both account-scoped and legacy unscoped private reads", async () => {
    const client = new QueryClient();
    client.setQueryData(["account-capabilities", "account-a"], {
      premium: true,
    });
    client.setQueryData(["assessment", "session-a"], { answer: "private" });
    await clearAccountQueries(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    client.setQueryData(["assessment", "session-b"], { answer: "B" });
    expect(client.getQueryData(["assessment", "session-a"])).toBeUndefined();
    expect(client.getQueryData(["assessment", "session-b"])).toEqual({
      answer: "B",
    });
    client.clear();
  });

  it("prevents a late account A response from repopulating the cache", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let resolve!: (value: string) => void;
    const response = new Promise<string>(done => {
      resolve = done;
    });
    const pending = client
      .fetchQuery({ queryKey: ["private-read"], queryFn: () => response })
      .catch(() => undefined);
    await clearAccountQueries(client);
    client.setQueryData(["private-read"], "account-b");
    resolve("account-a");
    await pending;
    await Promise.resolve();
    expect(client.getQueryData(["private-read"])).toBe("account-b");
    client.clear();
  });
});
