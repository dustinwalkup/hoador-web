import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

/**
 * The app-link association files in public/.well-known. Android and iOS fetch
 * them to decide whether to hand a link to the app, and a malformed file fails
 * silently: links just open in the browser.
 *
 * Plan: hoador-mobile/specs/mobile-app/tasks/android-app-links.md
 */
const read = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(process.cwd(), "public/.well-known", name), "utf8"),
  );

type AssetLinkStatement = {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
// Production (com.hoador.app) joins once it has a signing key: the EAS one,
// plus Google Play's app-signing key for store installs (P-E15-4).
const PACKAGES = ["com.hoador.app.staging"];

describe("public/.well-known/assetlinks.json", () => {
  const statements = read("assetlinks.json") as AssetLinkStatement[];

  it("lets each app package handle links, with a well-formed fingerprint", () => {
    expect(statements.map((s) => s.target.package_name).sort()).toEqual(
      [...PACKAGES].sort(),
    );
    for (const { relation, target } of statements) {
      expect(relation).toEqual(["delegate_permission/common.handle_all_urls"]);
      expect(target.namespace).toBe("android_app");
      expect(target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
      for (const fingerprint of target.sha256_cert_fingerprints) {
        expect(fingerprint).toMatch(SHA256);
      }
    }
  });
});

describe("public/.well-known/apple-app-site-association", () => {
  it("parses and names both bundle IDs", () => {
    const aasa = read("apple-app-site-association") as {
      applinks: { details: { appIDs: string[] }[] };
    };
    const appIDs = aasa.applinks.details.flatMap((d) => d.appIDs);
    expect(appIDs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\.com\.hoador\.app$/),
        expect.stringMatching(/\.com\.hoador\.app\.staging$/),
      ]),
    );
  });
});
