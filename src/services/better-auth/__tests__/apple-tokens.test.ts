import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  SignJWT,
  createLocalJWKSet,
  decodeJwt,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  type CryptoKey,
  type JWTVerifyGetKey,
} from "jose";
import {
  AppleTokenError,
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
  verifyAppleIdentityToken,
} from "../apple-tokens";

/**
 * Req 2.5.5 (P-E14-4). Apple's endpoints are stubbed at `fetch`; identity
 * tokens are signed with a key generated per run and verified against a local
 * key set, so the real verification rules (issuer, audience, age) run.
 */

const BUNDLE_ID = "com.hoador.app";
const SERVICES_ID = "com.hoador.services";

let signingKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });

  const secretPair = await generateKeyPair("ES256", { extractable: true });
  vi.stubEnv("APPLE_PRIVATE_KEY", await exportPKCS8(secretPair.privateKey));
});

beforeEach(() => {
  vi.stubEnv("APPLE_CLIENT_ID", SERVICES_ID);
  vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", BUNDLE_ID);
  vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
  vi.stubEnv("APPLE_KEY_ID", "KEY7890AB");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function identityToken(
  claims: { sub?: string; aud?: string; iss?: string; iat?: number } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(claims.iss ?? "https://appleid.apple.com")
    .setAudience(claims.aud ?? BUNDLE_ID)
    .setSubject(claims.sub ?? "apple-sub-1")
    .setIssuedAt(claims.iat ?? now)
    .setExpirationTime((claims.iat ?? now) + 600)
    .sign(signingKey);
}

describe("verifyAppleIdentityToken", () => {
  it("returns the Apple user and the client the token was issued to", async () => {
    expect(
      await verifyAppleIdentityToken(await identityToken(), { jwks }),
    ).toEqual({ sub: "apple-sub-1", aud: BUNDLE_ID });
  });

  it("falls back to the Services ID as audience, as better-auth does", async () => {
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "");

    const token = await identityToken({ aud: SERVICES_ID });

    expect(await verifyAppleIdentityToken(token, { jwks })).toEqual({
      sub: "apple-sub-1",
      aud: SERVICES_ID,
    });
  });

  it.each([
    ["another app's audience", { aud: "com.evil.app" }],
    ["another issuer", { iss: "https://evil.example.com" }],
    [
      "a token older than an hour",
      { iat: Math.floor(Date.now() / 1000) - 7200 },
    ],
  ])("rejects %s", async (_label, claims) => {
    expect(
      await verifyAppleIdentityToken(await identityToken(claims), { jwks }),
    ).toBeNull();
  });

  it("rejects a token signed with another key", async () => {
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://appleid.apple.com")
      .setAudience(BUNDLE_ID)
      .setSubject("apple-sub-1")
      .setIssuedAt()
      .sign(other.privateKey);

    expect(await verifyAppleIdentityToken(forged, { jwks })).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyAppleIdentityToken("not-a-jwt", { jwks })).toBeNull();
  });
});

describe("Apple token endpoints", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  const sentForm = (call = 0) => {
    const [url, init] = mockFetch.mock.calls[call] as [string, RequestInit];
    return { url, form: new URLSearchParams(init.body as URLSearchParams) };
  };

  describe("exchangeAppleAuthorizationCode", () => {
    it("exchanges the code as the given client and returns the refresh token and sub", async () => {
      const idToken = await identityToken({ sub: "apple-sub-9" });
      mockFetch.mockResolvedValue(
        Response.json({ refresh_token: "r-1", id_token: idToken }),
      );

      const result = await exchangeAppleAuthorizationCode({
        code: "code-1",
        clientId: BUNDLE_ID,
      });

      expect(result).toEqual({ refreshToken: "r-1", sub: "apple-sub-9" });
      const { url, form } = sentForm();
      expect(url).toBe("https://appleid.apple.com/auth/token");
      expect(form.get("grant_type")).toBe("authorization_code");
      expect(form.get("code")).toBe("code-1");
      expect(form.get("client_id")).toBe(BUNDLE_ID);
      // The client secret is minted for the same client it authenticates.
      expect(decodeJwt(form.get("client_secret")!).sub).toBe(BUNDLE_ID);
    });

    it("throws AppleTokenError with Apple's error code when the code is refused", async () => {
      mockFetch.mockResolvedValue(
        Response.json({ error: "invalid_grant" }, { status: 400 }),
      );

      await expect(
        exchangeAppleAuthorizationCode({ code: "used", clientId: BUNDLE_ID }),
      ).rejects.toMatchObject({
        name: "AppleTokenError",
        status: 400,
        appleError: "invalid_grant",
      });
    });

    it("throws when Apple returns no refresh token", async () => {
      mockFetch.mockResolvedValue(Response.json({ access_token: "a" }));

      await expect(
        exchangeAppleAuthorizationCode({ code: "c", clientId: BUNDLE_ID }),
      ).rejects.toBeInstanceOf(AppleTokenError);
    });
  });

  describe("revokeAppleRefreshToken", () => {
    it("revokes the refresh token as the client that issued it", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      await revokeAppleRefreshToken({
        refreshToken: "r-1",
        clientId: BUNDLE_ID,
      });

      const { url, form } = sentForm();
      expect(url).toBe("https://appleid.apple.com/auth/revoke");
      expect(form.get("token")).toBe("r-1");
      expect(form.get("token_type_hint")).toBe("refresh_token");
      expect(form.get("client_id")).toBe(BUNDLE_ID);
      expect(decodeJwt(form.get("client_secret")!).sub).toBe(BUNDLE_ID);
    });

    it("throws when Apple refuses", async () => {
      mockFetch.mockResolvedValue(
        Response.json({ error: "invalid_client" }, { status: 400 }),
      );

      await expect(
        revokeAppleRefreshToken({ refreshToken: "r-1", clientId: BUNDLE_ID }),
      ).rejects.toMatchObject({ appleError: "invalid_client" });
    });
  });
});
