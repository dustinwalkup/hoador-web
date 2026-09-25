/**
 * Server-side minimum-app-version gate (ARCH-06 / TEST-10). Disabled unless
 * MIN_APP_VERSION is set. A request with no x-app-version header (web, or a
 * binary shipped before the header existed) is never gated: fail-open by design.
 */

/** "1.2.3" -> [1,2,3]; anything else -> null. */
function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * True only when both parse AND appVersion < minVersion. A misconfigured
 * MIN_APP_VERSION or an unparsable client header both fail OPEN (false): a
 * typo in the env var must never lock every client out.
 */
export function isAppVersionBelowMinimum(
  appVersion: string,
  minVersion: string,
): boolean {
  const parsedMin = parseSemver(minVersion);
  if (!parsedMin) return false;
  const parsedApp = parseSemver(appVersion);
  if (!parsedApp) return false;
  for (let i = 0; i < 3; i++) {
    if (parsedApp[i] !== parsedMin[i]) return parsedApp[i] < parsedMin[i];
  }
  return false;
}
