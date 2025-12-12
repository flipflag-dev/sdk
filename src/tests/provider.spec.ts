// flipflag.test.ts
import { FlipFlag } from "../provider";

jest.useFakeTimers();

describe("FlipFlag (SDK manager)", () => {
  let readFileSpy: jest.SpyInstance;
  let yamlLoadSpy: jest.SpyInstance;

  const makeResponse = (opts: {
    ok: boolean;
    status?: number;
    json?: any;
    text?: string;
  }) =>
    ({
      ok: opts.ok,
      status: opts.status ?? (opts.ok ? 200 : 500),
      json: jest.fn(async () => opts.json ?? {}),
      text: jest.fn(async () => opts.text ?? ""),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock node:fs/promises readFile
    readFileSpy = jest
      .spyOn(require("node:fs/promises"), "readFile")
      .mockResolvedValue("");

    // Mock js-yaml load
    yamlLoadSpy = jest.spyOn(require("js-yaml"), "load").mockReturnValue({
      contributor: "dev@example.com",
      "my.feature": {
        times: [{ started: "2025-01-01T10:00:00.000Z", finished: null }],
      },
    });

    // Global fetch mock
    (global as any).fetch = jest.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        json: { "my.feature": { enabled: true } },
      }),
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    readFileSpy?.mockRestore();
    yamlLoadSpy?.mockRestore();
  });

  test("init() loads YAML, fetches flags, syncs times, and starts polling", async () => {
    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      apiUrl: "https://api.flipflag.dev",
    });

    await sdk.init();

    // 1) config read + yaml parsed
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(yamlLoadSpy).toHaveBeenCalledTimes(1);

    // 2) initial flags fetch
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sdk/feature/flags?publicKey=pub"),
      expect.objectContaining({ method: "GET" }),
    );

    // 3) syncFeaturesTimes triggers createFeature POST for YAML features (privateKey required)
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sdk/feature"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"privateKey":"priv"'),
      }),
    );

    // 4) polling every 10s
    const fetchCallsBefore = (global as any).fetch.mock.calls.length;
    jest.advanceTimersByTime(10_000);
    // allow queued microtasks to flush
    await Promise.resolve();

    const fetchCallsAfter = (global as any).fetch.mock.calls.length;
    expect(fetchCallsAfter).toBeGreaterThan(fetchCallsBefore);
  });

  test("loadConfigFromYaml(): ignores missing config when ignoreMissingConfig=true", async () => {
    readFileSpy.mockRejectedValueOnce(
      Object.assign(new Error("no file"), { code: "ENOENT" }),
    );

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await expect(sdk.init()).resolves.toBeUndefined();

    // Still attempts to fetch flags even if config is missing
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sdk/feature/flags?publicKey=pub"),
      expect.any(Object),
    );
  });

  test("loadConfigFromYaml(): throws on missing config when ignoreMissingConfig=false", async () => {
    readFileSpy.mockRejectedValueOnce(
      Object.assign(new Error("no file"), { code: "ENOENT" }),
    );

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: false,
    });

    await expect(sdk.init()).rejects.toThrow(/cannot read config/i);
  });

  test("loadConfigFromYaml(): throws on invalid YAML", async () => {
    yamlLoadSpy.mockImplementationOnce(() => {
      throw new Error("bad yaml");
    });

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
    });

    await expect(sdk.init()).rejects.toThrow(/invalid YAML/i);
  });

  test("loadConfigFromYaml(): throws if YAML root is not an object", async () => {
    yamlLoadSpy.mockReturnValueOnce(["not-an-object"]);

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
    });

    await expect(sdk.init()).rejects.toThrow(/YAML root must be an object/i);
  });

  test('loadConfigFromYaml(): throws on invalid "started" date', async () => {
    yamlLoadSpy.mockReturnValueOnce({
      contributor: "dev@example.com",
      "bad.feature": { times: [{ started: "NOT_A_DATE", finished: null }] },
    });

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
    });

    await expect(sdk.init()).rejects.toThrow(/invalid "started" date/i);
  });

  test('loadConfigFromYaml(): throws on invalid "finished" date', async () => {
    yamlLoadSpy.mockReturnValueOnce({
      contributor: "dev@example.com",
      "bad.feature": {
        times: [{ started: "2025-01-01T00:00:00.000Z", finished: "NOPE" }],
      },
    });

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
    });

    await expect(sdk.init()).rejects.toThrow(/invalid "finished" date/i);
  });

  test("getFeaturesFlags(): throws during init if publicKey is missing", async () => {
    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await expect(sdk.init()).rejects.toThrow(/Public key is missing/i);
  });

  test("getFeaturesFlags(): if response not ok during init, init rejects", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeResponse({ ok: false, status: 401, text: "unauthorized" }),
      );

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await expect(sdk.init()).rejects.toThrow(/Failed to get features/i);
  });

  test("isEnabled(): returns false and creates feature when local feature is missing", async () => {
    // fetch returns empty flags set
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({ ok: true, json: {} }));

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await sdk.init();
    const enabled = sdk.isEnabled("unknown.feature");

    expect(enabled).toBe(false);

    // createFeature should be attempted (POST /v1/sdk/feature) because privateKey exists
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sdk/feature"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"featureName":"unknown.feature"'),
      }),
    );
  });

  test("isEnabled(): returns cached enabled state and records usage", async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        json: { "my.feature": { enabled: true } },
      }),
    );

    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await sdk.init();

    expect(sdk.isEnabled("my.feature")).toBe(true);

    // usage is synced by the interval tick; advance time to trigger syncFeaturesUsage
    const callsBefore = (global as any).fetch.mock.calls.length;
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    const callsAfter = (global as any).fetch.mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);

    // Confirm POST to /v1/sdk/feature/usages includes the featureName
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sdk/feature/usages"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"featureName":"my.feature"'),
      }),
    );
  });

  test("syncFeaturesTimes(): does nothing if privateKey is missing", async () => {
    const sdk = new FlipFlag({
      publicKey: "pub",
      // privateKey missing
      ignoreMissingConfig: true,
    });

    await sdk.init();

    // should not POST /v1/sdk/feature (createFeature requires privateKey)
    const postFeatureCalls = (global as any).fetch.mock.calls.filter(
      (c: any[]) =>
        String(c[0]).includes("/v1/sdk/feature") && c[1]?.method === "POST",
    );
    // Note: usages sync is also POST but to /feature/usages
    const createFeatureCalls = postFeatureCalls.filter(
      (c: any[]) => !String(c[0]).includes("/v1/sdk/feature/usages"),
    );

    expect(createFeatureCalls.length).toBe(0);
  });

  test("destroy(): clears caches and stops polling", async () => {
    const sdk = new FlipFlag({
      publicKey: "pub",
      privateKey: "priv",
      ignoreMissingConfig: true,
    });

    await sdk.init();

    sdk.destroy();

    const callsBefore = (global as any).fetch.mock.calls.length;
    jest.advanceTimersByTime(20_000);
    await Promise.resolve();

    const callsAfter = (global as any).fetch.mock.calls.length;

    // no extra polling after destroy
    expect(callsAfter).toBe(callsBefore);

    // After destroy, unknown feature should be treated as missing again and return false
    expect(sdk.isEnabled("my.feature")).toBe(false);
  });
});
