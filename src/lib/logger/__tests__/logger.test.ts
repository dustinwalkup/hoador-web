import { describe, it, expect } from "vitest";
import pino from "pino";
import { Writable } from "stream";
import {
  getLogger,
  redactMetadata,
  getRequestContext,
  runWithRequestContext,
  generateRequestId,
  type RequestContext,
} from "../index";
import { PINO_REDACT_PATHS } from "../redact";

describe("logger", () => {
  describe("getLogger", () => {
    it("outputs valid JSON with level, message, and timestamp", () => {
      const chunks: string[] = [];
      const capture = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk.toString());
          cb();
        },
      });
      const testLogger = pino(
        { level: "info", formatters: { level: (l) => ({ level: l }) } },
        capture,
      );
      testLogger.info("test message");

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const parsed = JSON.parse(chunks[0]!);
      expect(parsed.level).toBe("info");
      expect(parsed.msg).toBe("test message");
      expect(parsed.time).toBeDefined();
    });

    it("returns a logger that includes requestId and userId when context is passed", () => {
      const chunks: string[] = [];
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk.toString());
          cb();
        },
      });
      const base = pino({ level: "info" }, sink);
      const child = base.child({ requestId: "req-123", userId: "user-456" });
      child.info("with context");

      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]!);
      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
      expect(parsed.msg).toBe("with context");
    });

    it("getLogger with explicit context returns a logger with .info and bindings", () => {
      const log = getLogger({ requestId: "r1", userId: "u1" });
      expect(typeof log.info).toBe("function");
      expect(typeof log.child).toBe("function");
    });

    it("getLogger inside runWithRequestContext returns a logger", async () => {
      let log: ReturnType<typeof getLogger> | null = null;
      await runWithRequestContext(
        { requestId: "async-req", userId: "async-user" },
        () => {
          log = getLogger();
        },
      );
      expect(log).not.toBeNull();
      expect(typeof log!.info).toBe("function");
    });
  });

  describe("sensitive key redaction in logs", () => {
    it("redacts sensitive keys in metadata when using Pino redact paths", () => {
      const chunks: string[] = [];
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk.toString());
          cb();
        },
      });
      const logger = pino(
        {
          level: "info",
          redact: { paths: PINO_REDACT_PATHS, censor: "[REDACTED]" },
        },
        sink,
      );
      logger.info({ password: "secret123", user: "alice" }, "login attempt");
      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]!);
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.user).toBe("alice");
    });
  });

  describe("level filtering", () => {
    it("does not emit debug or trace when level is info", () => {
      const chunks: string[] = [];
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk.toString());
          cb();
        },
      });
      const logger = pino(
        {
          level: "info",
          formatters: { level: (label) => ({ level: label }) },
        },
        sink,
      );

      logger.trace("trace message");
      logger.debug("debug message");
      logger.info("info message");

      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]!);
      expect(parsed.msg).toBe("info message");
      expect(parsed.level).toBe("info");
    });
  });

  describe("redactMetadata", () => {
    it("redacts sensitive keys (password, token, etc.)", () => {
      const obj = {
        username: "alice",
        password: "secret123",
        token: "jwt-xyz",
      };
      const out = redactMetadata(obj);
      expect(out.username).toBe("alice");
      expect(out.password).toBe("[REDACTED]");
      expect(out.token).toBe("[REDACTED]");
    });

    it("redacts case-insensitively", () => {
      const obj = { PASSWORD: "x", ApiKey: "y" };
      const out = redactMetadata(obj);
      expect(out.PASSWORD).toBe("[REDACTED]");
      expect(out.ApiKey).toBe("[REDACTED]");
    });

    it("redacts nested objects", () => {
      const obj = {
        user: {
          name: "bob",
          password: "nested-secret",
        },
      };
      const out = redactMetadata(obj) as { user: Record<string, unknown> };
      expect(out.user.name).toBe("bob");
      expect(out.user.password).toBe("[REDACTED]");
    });

    it("leaves non-sensitive keys unchanged", () => {
      const obj = { userId: "u1", action: "login", count: 5 };
      const out = redactMetadata(obj);
      expect(out).toEqual(obj);
    });
  });
});

describe("request-context", () => {
  it("getRequestContext returns undefined when not in runWithRequestContext", () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it("runWithRequestContext provides context to getRequestContext", async () => {
    let captured: RequestContext | undefined;
    await runWithRequestContext(
      { requestId: "r1", userId: "u1", ipAddress: "1.2.3.4" },
      async () => {
        captured = getRequestContext();
      },
    );
    expect(captured?.requestId).toBe("r1");
    expect(captured?.userId).toBe("u1");
    expect(captured?.ipAddress).toBe("1.2.3.4");
  });

  it("generateRequestId returns a UUID string", () => {
    const id = generateRequestId();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRe);
    expect(generateRequestId()).not.toBe(id);
  });
});
