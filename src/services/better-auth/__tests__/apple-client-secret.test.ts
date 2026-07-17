import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  decodeProtectedHeader,
  decodeJwt,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  type CryptoKey,
} from "jose";
import {
  generateAppleClientSecret,
  APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS,
} from "../apple-client-secret";

/**
 * Req 2.4.1 — Apple's "client secret" is an ES256 JWT we mint from the .p8 key.
 * Apple rejects a malformed or over-long one at sign-in time with an opaque
 * error, so the claim shape is asserted here rather than discovered in staging.
 *
 * The key pair is generated per run — no private key material lives in the repo.
 */

const PARAMS = {
  clientId: "com.hoador.services",
  teamId: "TEAM123456",
  keyId: "KEY7890AB",
};

let privateKeyPem: string;
let publicKey: CryptoKey;

beforeAll(async () => {
  const { privateKey, publicKey: pub } = await generateKeyPair("ES256", {
    extractable: true,
  });
  privateKeyPem = await exportPKCS8(privateKey);
  publicKey = pub as CryptoKey;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateAppleClientSecret", () => {
  it("should sign with ES256 and identify the key via the kid header", async () => {
    // Arrange & Act
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: privateKeyPem,
    });

    // Assert
    expect(decodeProtectedHeader(secret)).toMatchObject({
      alg: "ES256",
      kid: PARAMS.keyId,
    });
  });

  it("should set the issuer, subject and audience Apple expects", async () => {
    // Arrange & Act
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: privateKeyPem,
    });

    // Assert — iss is the Team ID, sub is the Services ID, aud is Apple.
    expect(decodeJwt(secret)).toMatchObject({
      iss: PARAMS.teamId,
      sub: PARAMS.clientId,
      aud: "https://appleid.apple.com",
    });
  });

  it("should produce a secret that verifies against the signing key", async () => {
    // Arrange
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: privateKeyPem,
    });

    // Act
    const { payload } = await jwtVerify(secret, publicKey, {
      audience: "https://appleid.apple.com",
      issuer: PARAMS.teamId,
    });

    // Assert
    expect(payload.sub).toBe(PARAMS.clientId);
  });

  it("should expire within Apple's six month ceiling", async () => {
    // Arrange & Act
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: privateKeyPem,
    });
    const { iat, exp } = decodeJwt(secret);

    // Assert — Apple rejects anything longer than 15,777,000s.
    expect(iat).toBeDefined();
    expect(exp).toBeDefined();
    expect(exp! - iat!).toBeLessThanOrEqual(
      APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS,
    );
    expect(exp! - iat!).toBe(180 * 24 * 60 * 60);
  });

  it("should issue the secret at the current time", async () => {
    // Arrange — a fixed clock makes iat/exp deterministic.
    const now = new Date("2026-07-16T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Act
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: privateKeyPem,
    });

    // Assert
    expect(decodeJwt(secret).iat).toBe(Math.floor(now.getTime() / 1000));
  });

  it("should accept a private key stored with literal \\n escapes", async () => {
    // Arrange — how Vercel and .env files hold a multi-line PEM.
    const escaped = privateKeyPem.replace(/\n/g, "\\n");

    // Act
    const secret = await generateAppleClientSecret({
      ...PARAMS,
      privateKey: escaped,
    });

    // Assert
    await expect(
      jwtVerify(secret, publicKey, { issuer: PARAMS.teamId }),
    ).resolves.toBeDefined();
  });

  it("should reject a private key that is not a usable PKCS#8 PEM", async () => {
    // Arrange & Act & Assert — fail loudly at startup rather than emit a
    // secret Apple will silently refuse.
    await expect(
      generateAppleClientSecret({ ...PARAMS, privateKey: "not-a-key" }),
    ).rejects.toThrow();
  });
});
