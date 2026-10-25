import { describe, expect, it, vi } from "vitest";
import {
  callNexaBridge,
  fingerprintNexaAcademicContext,
  type NexaBridgeAcademicContext,
  type NexaBridgeCall,
} from "./nexaBridgeTransport";

const configuration = {
  baseUrl: "https://nexa.example.test",
  secret: "test-only-key-".repeat(3),
  timeoutMs: 12_000,
};

const academicContext: NexaBridgeAcademicContext = {
  authority: "student-os-learning-intelligence",
  snapshotId: "workspace:9",
  evidence: ["Learner-local topic estimate: 48/100."],
  constraints: ["Never modify a mastery decision."],
};

function call(overrides: Partial<NexaBridgeCall> = {}): NexaBridgeCall {
  return {
    subject: { userId: "owner-a" },
    prompt: "Explain factorisation",
    capability: "explain",
    configuration,
    ...overrides,
  };
}

function successfulResponse(
  request: RequestInit,
  overrides: {
    context?: NexaBridgeAcademicContext | null;
    payload?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const body = JSON.parse(String(request.body)) as {
    capability: string;
    request: {
      requestId: string;
      academicContext?: NexaBridgeAcademicContext;
    };
  };
  const context = overrides.context ?? body.request.academicContext ?? null;
  const fingerprint = context ? fingerprintNexaAcademicContext(context) : null;
  const metadata = {
    contractVersion: "1.0",
    nexaVersion: "1.96.0",
    capability: body.capability,
    academicDecisionAuthority: "student-os-learning-intelligence",
    academicContext: context
      ? {
          bindingVersion: "sha256-v1",
          snapshotId: context.snapshotId ?? null,
          fingerprint,
          evidenceCount: context.evidence.length,
          constraintCount: context.constraints?.length ?? 0,
        }
      : null,
  };
  const payload = {
    ok: true,
    requestId: body.request.requestId,
    capability: body.capability,
    content: "Factorisation creates a product of factors.",
    metadata,
    ...overrides.payload,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-nexa-bridge-contract": "1.0",
      "x-nexa-provider-contract": "1.0",
      "x-nexa-bridge-request-id": body.request.requestId,
      ...(fingerprint ? { "x-nexa-academic-context-sha256": fingerprint } : {}),
      ...overrides.headers,
    },
  });
}

function fakeFetch(
  build: (init: RequestInit) => Response | Promise<Response>
): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (!init) throw Error("Missing fetch options");
    return build(init);
  }) as unknown as typeof fetch;
}

describe("Track B NEXA bridge v1 contract", () => {
  it("fails closed without configuration or with invalid secret/URL", async () => {
    expect(await callNexaBridge(call({ configuration: null }))).toEqual({
      ok: false,
      reason: "disabled",
    });
    expect(
      await callNexaBridge(
        call({
          configuration: { ...configuration, secret: "weak" },
        })
      )
    ).toEqual({ ok: false, reason: "disabled" });
    expect(
      await callNexaBridge(
        call({
          configuration: {
            ...configuration,
            baseUrl: "http://nexa.example.test",
          },
        })
      )
    ).toEqual({ ok: false, reason: "disabled" });
    expect(
      await callNexaBridge(
        call({
          configuration: {
            ...configuration,
            baseUrl: "https://nexa.example.test@attacker.test",
          },
        })
      )
    ).toEqual({ ok: false, reason: "disabled" });
  });

  it("sends the exact contract, owner identity and canonical context", async () => {
    const fetchImpl = fakeFetch(init => successfulResponse(init));
    const result = await callNexaBridge(
      call({
        academicContext,
        fetchImpl,
      })
    );
    expect(result).toMatchObject({
      ok: true,
      capability: "explain",
      advisoryOnly: true,
    });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("https://nexa.example.test/api/integrations/student-os");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-nexa-bridge-accept-contract")).toBe("1.0");
    expect(headers.get("authorization")).toBe("Bearer " + configuration.secret);
    expect(headers.get("x-student-os-user-id")).toBe("owner-a");
    const body = JSON.parse(String(init?.body));
    expect(body.request.userId).toBe("owner-a");
    expect(body.request.academicContext.snapshotId).toBe("workspace:9");
    expect(body.request.academicContext.authority).toBe(
      "student-os-learning-intelligence"
    );
    expect(body).not.toHaveProperty("verifiedMastery");
  });

  it("reproduces NEXA sha256-v1 canonical whitespace normalization", () => {
    const first = fingerprintNexaAcademicContext(academicContext);
    const second = fingerprintNexaAcademicContext({
      ...academicContext,
      snapshotId: " workspace:9 ",
      evidence: [" Learner-local topic estimate:  48/100. "],
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
    expect(
      fingerprintNexaAcademicContext({
        ...academicContext,
        evidence: ["Learner-local topic estimate: 49/100."],
      })
    ).not.toBe(first);
  });

  it("accepts a no-context response only when metadata has no context", async () => {
    const result = await callNexaBridge(
      call({ fetchImpl: fakeFetch(init => successfulResponse(init)) })
    );
    expect(result).toMatchObject({ ok: true, advisoryOnly: true });
  });

  it("rejects context fingerprints that differ from the sent snapshot", async () => {
    const fetchImpl = fakeFetch(init =>
      successfulResponse(init, {
        headers: {
          "x-nexa-academic-context-sha256": "a".repeat(64),
        },
      })
    );
    expect(await callNexaBridge(call({ academicContext, fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it("rejects spoofed academic metadata even when the header matches", async () => {
    const fetchImpl = fakeFetch(init => {
      const base = successfulResponse(init);
      const request = JSON.parse(String(init.body));
      const metadata = {
        contractVersion: "1.0",
        capability: "explain",
        academicDecisionAuthority: "student-os-learning-intelligence",
        academicContext: {
          bindingVersion: "sha256-v1",
          fingerprint: "b".repeat(64),
          snapshotId: "workspace:9",
          evidenceCount: 1,
          constraintCount: 1,
        },
      };
      return successfulResponse(init, {
        payload: {
          requestId: request.request.requestId,
          metadata,
        },
        headers: {
          "x-nexa-academic-context-sha256":
            base.headers.get("x-nexa-academic-context-sha256") ?? "",
        },
      });
    });
    expect(await callNexaBridge(call({ academicContext, fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [409, "incompatible"],
    [428, "incompatible"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ] as const)("maps HTTP %i to bounded %s fallback", async (status, reason) => {
    const fetchImpl = fakeFetch(() => new Response("Unavailable", { status }));
    expect(await callNexaBridge(call({ fetchImpl }))).toEqual({
      ok: false,
      reason,
    });
  });

  it("rejects incorrect protocol and provider metadata versions", async () => {
    const fetchImpl = fakeFetch(init =>
      successfulResponse(init, {
        headers: { "x-nexa-bridge-contract": "2.0" },
      })
    );
    expect(await callNexaBridge(call({ fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it("rejects a success body that references a different request", async () => {
    const fetchImpl = fakeFetch(init =>
      successfulResponse(init, {
        payload: { requestId: "another-user-request" },
      })
    );
    expect(await callNexaBridge(call({ fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it("bounds unknown-size streaming responses before parsing", async () => {
    const fetchImpl = fakeFetch(
      () =>
        new Response("x".repeat(50_100), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    expect(await callNexaBridge(call({ fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it("rejects malformed JSON and inappropriate HTML responses", async () => {
    const fetchImpl = fakeFetch(
      () =>
        new Response("<html>not json</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    expect(await callNexaBridge(call({ fetchImpl }))).toEqual({
      ok: false,
      reason: "malformed_response",
    });
  });

  it("does not issue network requests for invalid academic context", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const invalid = {
      ...academicContext,
      evidence: ["z".repeat(1_201)],
    };
    expect(
      await callNexaBridge(call({ academicContext: invalid, fetchImpl }))
    ).toEqual({ ok: false, reason: "invalid_request" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("cancels before sending when the authenticated caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(
      await callNexaBridge(call({ signal: controller.signal, fetchImpl }))
    ).toEqual({ ok: false, reason: "cancelled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
