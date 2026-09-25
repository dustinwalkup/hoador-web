import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// All five `/api/test/*` routes import `@/db/db`, which opens a real
// Neon/Postgres connection pool at import time. Mock it so importing the
// route modules never connects anywhere, and so we can assert the DB is
// never touched when a route is gated shut.
const dbMock = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/db/db", () => ({ db: dbMock }));

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const moduleSpecs = [
  { name: "last-email", path: "../last-email/route" },
  { name: "reset-user", path: "../reset-user/route" },
  { name: "create-need", path: "../create-need/route" },
  {
    name: "set-stripe-connect-state",
    path: "../set-stripe-connect-state/route",
  },
  { name: "delete-need", path: "../delete-need/route" },
];

type HandlerFn = (
  req: NextRequest,
  ctx?: unknown,
) => Promise<Response> | Response;

interface Pair {
  name: string;
  path: string;
  method: (typeof HTTP_METHODS)[number];
}

// Discover which HTTP handlers each route module actually exports, so this
// test automatically covers any handler added later (e.g. if a route grows
// a second method) without needing to hardcode GET/POST per file.
const pairs: Pair[] = [];
for (const spec of moduleSpecs) {
  const mod = (await import(spec.path)) as Record<string, unknown>;
  for (const method of HTTP_METHODS) {
    if (typeof mod[method] === "function") {
      pairs.push({ name: spec.name, path: spec.path, method });
    }
  }
}

// Sanity check on the discovery above: if this ever drops to 0, the dynamic
// import silently found nothing and every case below would vacuously pass.
if (pairs.length === 0) {
  throw new Error(
    "gating.test.ts found no exported HTTP handlers under src/app/api/test/*/route.ts",
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function callHandler(path: string, method: string): Promise<Response> {
  const mod = (await import(path)) as Record<string, unknown>;
  const handler = mod[method] as HandlerFn;
  const request = new NextRequest(`http://localhost/api/test/probe`, {
    method,
  });
  return handler(request, { params: Promise.resolve({}) });
}

function expectDbUntouched() {
  expect(dbMock.select).not.toHaveBeenCalled();
  expect(dbMock.insert).not.toHaveBeenCalled();
  expect(dbMock.update).not.toHaveBeenCalled();
  expect(dbMock.delete).not.toHaveBeenCalled();
}

describe("api/test/* gating", () => {
  it.each(pairs)(
    "$name $method 404s when NODE_ENV=production and E2E_TEST=1",
    async ({ path, method }) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("E2E_TEST", "1");

      const response = await callHandler(path, method);

      expect(response.status).toBe(404);
      expectDbUntouched();
    },
  );

  it.each(pairs)(
    "$name $method 404s when NODE_ENV=test and E2E_TEST is unset",
    async ({ path, method }) => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("E2E_TEST", "");

      const response = await callHandler(path, method);

      expect(response.status).toBe(404);
      expectDbUntouched();
    },
  );
});
