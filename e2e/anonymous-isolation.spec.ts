import { expect, test, type BrowserContext } from "@playwright/test";

const privateMarker = "ACCOUNT-A-PRIVATE-FIXTURE";
async function anonymousServer(context: BrowserContext) {
  const requests: Array<{ authorization: string | undefined; url: string }> =
    [];
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    // This harness cannot call Manus, OAuth, AI, telemetry or any live API.
    if (url.origin !== "http://127.0.0.1:4173") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    requests.push({
      authorization: request.headers().authorization,
      url: url.pathname,
    });
    if (url.pathname === "/api/trpc/auth.me") {
      const result = { result: { data: { json: null } } };
      return route.fulfill({
        contentType: "application/json",
        headers: { "cache-control": "private, no-store" },
        body: JSON.stringify(url.searchParams.has("batch") ? [result] : result),
      });
    }
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"fixture-unavailable"}',
    });
  });
  return requests;
}

async function privateStorage(context: BrowserContext) {
  await context.addInitScript(marker => {
    localStorage.setItem(
      "studentos-runtime-user-info",
      JSON.stringify({ openId: "account-a", name: marker })
    );
    localStorage.setItem(
      "studentos-state",
      JSON.stringify({ profile: { name: marker }, premium: true })
    );
    sessionStorage.setItem("studentos-cookie", "fixture-not-a-session");
  }, privateMarker);
}

test("two mobile tabs reject stored identity and never forward browser-readable tokens", async ({
  context,
}) => {
  const requests = await anonymousServer(context);
  await privateStorage(context);
  const first = await context.newPage();
  const second = await context.newPage();
  for (const page of [first, second]) {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Log in", exact: true })
    ).toBeVisible();
    await expect(page.getByText(privateMarker)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true })
    ).toHaveCount(0);
  }
  expect(
    requests.filter(request => request.url.includes("auth.me"))
  ).toHaveLength(2);
  expect(requests.every(request => request.authorization === undefined)).toBe(
    true
  );
  expect(requests.some(request => request.url.includes("workspace"))).toBe(
    false
  );
});

test("session lookup failure keeps private storage behind the signed-out boundary", async ({
  context,
  page,
}) => {
  await privateStorage(context);
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:4173") return route.abort();
    if (url.pathname.startsWith("/api/"))
      return route.abort("internetdisconnected");
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "could not check your session"
  );
  await expect(page.getByText(privateMarker)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Log in", exact: true })
  ).toBeVisible();
});

test("signed-out mobile shell supports keyboard focus and has no horizontal overflow", async ({
  context,
  page,
}) => {
  await anonymousServer(context);
  await page.goto("/");
  const signup = page.getByRole("button", {
    name: "Create an account",
    exact: true,
  });
  await expect(signup).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(signup).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Log in", exact: true })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});
