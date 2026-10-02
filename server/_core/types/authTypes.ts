// Provider-neutral OAuth/OIDC integration types.

export interface AuthorizeRequest {
  redirectUri: string;
  clientId: string;
  state: string;
  responseType: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
}

export interface AuthorizeResponse {
  redirectUrl: string;
}

export interface OAuthTokenExchangeRequest {
  grantType: "authorization_code";
  code: string;
  refreshToken?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope?: string;
  idToken?: string;
}

export interface UserInfoRequest {
  accessToken: string;
}

export interface UserInfoResponse {
  subject: string;
  clientId?: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
}

export interface AccessCheckRequest {
  subject: string;
  clientId: string;
}

export interface AccessCheckResponse {
  canAccess: boolean;
}

/** Internal scheduler identity request. Provider-neutral by design. */
export interface GetAuthenticatedIdentityRequest {
  jwtToken: string;
  clientId: string;
}

/** Internal scheduler identity response. */
export interface GetAuthenticatedIdentityResponse {
  subject: string;
  clientId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
  /** Scheduler-only; references the persisted schedule task. */
  taskUid?: string | null;
}
