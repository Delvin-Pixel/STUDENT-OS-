import { describe, expect, it, vi } from "vitest";
import {
  callNexaProvider,
  normalizeNexaProviderConfig,
  selectNexaProviderCapability,
  type NexaProviderConfig,
} from "./nexaProvider";

const config: NexaProviderConfig = {
  baseUrl: "https://nexa.example.test",
  secret: "s".repeat(32),
  timeoutMs: 12_000,
};

describe("Student OS NEXA provider consumer", () => {
  it("keeps the bridge disabled when config is missing or weak", () => {
    expect(
      normalizeNexaProviderConfig({
        url: "",
        secret: "",
        isProduction: true,
      })
    ).toBeNull();
    expect(
      normalizeNexaProviderConfig({
        url: "https://nexa.example.test",
        secret: "short",
        isProduction: true,
      })
    ).toBeNull();
  });

  it("requires HTTPS in production and only permits local HTTP in development", () => {
    expect(
      normalizeNexaProviderConfig({
        url: "http://nexa.example.test",
        secret: "s".repeat(32),
        isProduction: true,
      })
    ).toBeNull();
    expect(
      normalizeNexaProviderConfig({
        url: "http://localhost:3001",
        secret: "s".repeat(32),
        isProduction: false,
      })
    ).toEqual({
      baseUrl: "http://localhost:3001",
      secret: "s".repeat(32),
      timeoutMs: 12_000,
    });
  });

  it("selects only the six versioned provider capabilities", () => {
    expect(selectNexaProviderCapability("Create a short quiz on algebra")).toBe(
      "generateQuiz"
    );
    expect(
      selectNexaProviderCapability("Teach me factorisation step by step")
    ).toBe("tutor");
    expect(selectNexaProviderCapability("Explain photosynthesis")).toBe(
      "explain"
    );
    expect(selectNexaProviderCapability("What should I study next?")).toBe(
      "coach"
    );
    expect(selectNexaProviderCapability("Hello there")).toBe("chat");
  });

  it("sends the secret and authenticated user identity only server-to-server", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            ok: true,
            requestId: body.request.requestId,
            capability: body.capability,
            content:
              "Factorisation rewrites an expression as a product of factors.",
            metadata: {
              contractVersion: "1.0",
              nexaVersion: "1.59.0",
              capability: body.capability,
              academicDecisionAuthority: "student-os-learning-intelligence",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    ) as unknown as typeof fetch;

    const result = await callNexaProvider({
      userId: "student-1",
      question: "Explain factorisation",
      academicContext: {
        authority: "student-os-learning-intelligence",
        snapshotId: "workspace:7",
        evidence: ["Canonical readiness 48/100."],
        constraints: ["Do not change readiness."],
      },
      config,
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      capability: "explain",
    });
    expect(capturedUrl).toBe(
      "https://nexa.example.test/api/integrations/student-os"
    );
    expect(new Headers(capturedInit?.headers).get("authorization")).toBe(
      `Bearer ${config.secret}`
    );
    expect(new Headers(capturedInit?.headers).get("x-student-os-user-id")).toBe(
      "student-1"
    );
    const sent = JSON.parse(String(capturedInit?.body));
    expect(sent.request.userId).toBe("student-1");
    expect(sent.request.academicContext.authority).toBe(
      "student-os-learning-intelligence"
    );
  });

  it("fails soft when the bridge is disabled", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      callNexaProvider({
        userId: "student-1",
        question: "Hello",
        config: null,
        fetchImpl,
      })
    ).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects malformed or oversized bridge responses", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, content: "x".repeat(8_001) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;

    await expect(
      callNexaProvider({
        userId: "student-1",
        question: "Hello",
        config,
        fetchImpl,
      })
    ).resolves.toEqual({ ok: false, reason: "malformed_response" });
  });
});
