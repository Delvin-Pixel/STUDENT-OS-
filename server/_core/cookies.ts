import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    // SameSite=Lax is mobile-safe: it is sent on same-site requests and on
    // top-level cross-site GET navigations (the OAuth callback redirect).
    // SameSite=None requires the Secure attribute and is silently dropped by
    // some mobile browsers, which caused a sign-in redirect loop in practice.
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
