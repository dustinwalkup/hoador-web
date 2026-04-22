import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockBrowser = { newPage: vi.fn(), close: vi.fn() };

const mockPuppeteerLaunch = vi.fn().mockResolvedValue(mockBrowser);

vi.mock("puppeteer-core", () => ({
  default: { launch: mockPuppeteerLaunch },
}));

const mockExecPath = vi.fn().mockResolvedValue("/opt/chromium");
const mockArgs = ["--no-sandbox", "--single-process"];

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: mockArgs,
    executablePath: mockExecPath,
  },
}));

const mockExistsSync = vi.fn();

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: mockExistsSync };
});

describe("launchBrowser", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses @sparticuz/chromium executablePath when VERCEL is set", async () => {
    process.env.VERCEL = "1";
    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockExecPath).toHaveBeenCalled();
    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: mockArgs,
        executablePath: "/opt/chromium",
        headless: true,
      }),
    );
  });

  it("uses @sparticuz/chromium executablePath when AWS_LAMBDA_FUNCTION_NAME is set", async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "my-function";
    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockExecPath).toHaveBeenCalled();
    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: mockArgs,
        executablePath: "/opt/chromium",
      }),
    );
  });

  it("uses local Chrome path when running locally and Chrome exists", async () => {
    mockExistsSync.mockImplementation(
      (p: string) =>
        p === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );

    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockExecPath).not.toHaveBeenCalled();
    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }),
    );
  });

  it("falls back to second local path when first does not exist", async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );

    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: "/Applications/Chromium.app/Contents/MacOS/Chromium",
      }),
    );
  });

  it("falls back to @sparticuz/chromium when no local browser is found", async () => {
    mockExistsSync.mockReturnValue(false);

    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockExecPath).toHaveBeenCalled();
    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: "/opt/chromium",
      }),
    );
  });

  it("sets defaultViewport to 1280x720", async () => {
    process.env.VERCEL = "1";
    const { launchBrowser } = await import("../launch-browser");

    await launchBrowser();

    expect(mockPuppeteerLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultViewport: { width: 1280, height: 720 },
      }),
    );
  });

  it("returns the browser instance from puppeteer.launch", async () => {
    process.env.VERCEL = "1";
    const { launchBrowser } = await import("../launch-browser");

    const browser = await launchBrowser();

    expect(browser).toBe(mockBrowser);
  });
});
