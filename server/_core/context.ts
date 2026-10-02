import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Aborted when the client disconnects before the request finishes. */
  signal?: AbortSignal;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  const controller = new AbortController();
  const abortIfOpen = () => {
    if (!opts.res.writableEnded) controller.abort();
  };
  const cleanup = () => {
    opts.req.off("aborted", abortIfOpen);
    opts.req.off("close", abortIfOpen);
    opts.res.off("close", abortIfOpen);
  };
  opts.req.once("aborted", abortIfOpen);
  opts.req.once("close", abortIfOpen);
  opts.res.once("close", abortIfOpen);
  opts.res.once("finish", cleanup);

  return {
    req: opts.req,
    res: opts.res,
    user,
    signal: controller.signal,
  };
}
