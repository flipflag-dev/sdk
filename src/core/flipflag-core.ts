import {
  FlipFlagYaml,
  IDeclareFeatureOptions,
  IFeatureFlag,
  IFeatureFlagUsage,
  IManagerOptions,
  IMetricEvent,
  ITrackEventParams,
  ITrackMetricParams,
} from "../types/provider";
import { ConfigLoader } from "../platform/config-loader";

export class FlipFlagCore {
  private inited = false;
  private pollingIntervalTimer: any = null;
  private syncIntervalTimer: any = null;

  protected options: Partial<IManagerOptions>;
  private featuresDeclarations: Record<string, IDeclareFeatureOptions> = {};
  private featuresFlags: Record<string, IFeatureFlag> = {};
  private featuresUsage: IFeatureFlagUsage[] = [];
  private metricsQueue: IMetricEvent[] = [];

  constructor(
    protected readonly opts: IManagerOptions,
    private readonly loader?: ConfigLoader,
  ) {
    this.options = {
      apiUrl: "https://api.flipflag.dev",
      flagsFallbackApiUrl: "https://sdk-fallback.flipflag.dev",
      pollingInterval: 30_000,
      syncInterval: 90_000,
      requestTimeout: 2_000,
      ...opts,
    };
  }

  public async init() {
    if (this.loader) {
      const yamlDoc = await this.loader.load();
      if (yamlDoc) this.applyYamlConfig(yamlDoc);
    }

    await this.getFeaturesFlags();
    await this.syncFeaturesDeclarations();

    this.pollingIntervalTimer = setInterval(() => {
      this.getFeaturesFlags();
    }, this.options.pollingInterval);

    this.syncIntervalTimer = setInterval(() => {
      this.syncFeaturesUsage();
      this.flushMetrics();
    }, this.options.syncInterval);

    this.inited = true;
  }

  public destroy() {
    this.inited = false;
    if (this.pollingIntervalTimer) clearInterval(this.pollingIntervalTimer);
    if (this.syncIntervalTimer) clearInterval(this.syncIntervalTimer);
    this.featuresDeclarations = {};
    this.featuresFlags = {};
    this.featuresUsage = [];
    this.metricsQueue = [];
  }

  public isEnabled(featureName: string) {
    const feature = this.featuresFlags[featureName];
    if (!feature) {
      this.createFeature(featureName, {});
      return false;
    }
    this.upsertFeaturesUsage(featureName);
    return feature.enabled;
  }

  public declareFromObject(doc: FlipFlagYaml) {
    this.applyYamlConfig(doc);
  }

  public async sync() {
    await this.syncFeaturesDeclarations();
    await this.syncFeaturesUsage();
  }

  public trackAssignment(params: ITrackEventParams): void {
    this.enqueueMetricEvent({ ...params, eventType: 'assignment' });
  }

  public trackExposure(params: ITrackEventParams): void {
    this.enqueueMetricEvent({ ...params, eventType: 'exposure' });
  }

  public trackMetric(params: ITrackMetricParams): void {
    this.enqueueMetricEvent({ ...params, eventType: 'metric' });
  }

  private enqueueMetricEvent(event: Omit<IMetricEvent, 'eventId' | 'clientTs'>): void {
    this.metricsQueue.push({
      ...event,
      eventId: crypto.randomUUID(),
      clientTs: new Date().toISOString(),
    });
    if (this.metricsQueue.length >= 500) {
      this.flushMetrics();
    }
  }

  private flushMetrics(): void {
    if (!this.options.privateKey || this.metricsQueue.length === 0) return;

    const events = this.metricsQueue.splice(0, this.metricsQueue.length);
    const url = new URL("/v1/sdk/metrics/events", this.getBaseUrl());

    fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privateKey: this.options.privateKey, events }),
    }).catch((e) => console.error("Metrics Flush:", e));
  }

  private applyYamlConfig(doc: FlipFlagYaml) {
    for (const [featureName, cfg] of Object.entries(doc)) {
      this.featuresDeclarations[featureName] = {
        contributor: cfg?.contributor,
        type: cfg?.type,
        description: cfg?.description,
      };
    }
  }

  private upsertFeaturesUsage(featureName: string) {
    const existing = this.featuresUsage.find(
      (u) => u.featureName === featureName,
    );
    if (existing) {
      existing.usedAt = new Date();
      return;
    }
    this.featuresUsage.push({ featureName, usedAt: new Date() });
  }

  private getBaseUrl() {
    if (this.options.apiUrl) return this.options.apiUrl.replace(/\/+$/, "");
    throw new Error(
      "Base API URL is not configured. Please provide apiUrl in the SDK options.",
    );
  }

  private getFlagsFallbackBaseUrl() {
    return this.options.flagsFallbackApiUrl?.replace(/\/+$/, "") || null;
  }

  private buildSdkUrl(path: string, baseUrl: string) {
    return new URL(path, baseUrl);
  }

  private async requestFeaturesFlags(baseUrl: string, publicKey: string) {
    const url = this.buildSdkUrl("/v1/sdk/feature/flags", baseUrl);
    url.searchParams.append("publicKey", publicKey);

    const res = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(this.options.requestTimeout!),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const error = new Error(
        `Failed to get features: ${res.status} - ${errorText}`,
      ) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    return (await res.json()) as Record<string, IFeatureFlag>;
  }

  private shouldUseFlagsFallback(error: unknown) {
    if (!this.getFlagsFallbackBaseUrl()) return false;
    if (!(error instanceof Error)) return true;

    const status =
      "status" in error && typeof error.status === "number"
        ? error.status
        : undefined;

    return typeof status !== "number" || status >= 500;
  }

  private async createFeature(
    featureName: string,
    options: IDeclareFeatureOptions,
  ) {
    if (!this.options.privateKey) return null;

    const url = this.buildSdkUrl("/v1/sdk/feature", this.getBaseUrl());
    fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        featureName,
        privateKey: this.options.privateKey,
        ...options,
      }),
    }).catch((e) => console.error("Create Feature:", e));
  }

  private async getFeaturesFlags() {
    if (!this.options.publicKey) {
      throw new Error(
        "Public key is missing. Please provide a valid publicKey in the SDK configuration.",
      );
    }

    try {
      this.featuresFlags = await this.requestFeaturesFlags(
        this.getBaseUrl(),
        this.options.publicKey,
      );
    } catch (e) {
      if (this.shouldUseFlagsFallback(e)) {
        try {
          this.featuresFlags = await this.requestFeaturesFlags(
            this.getFlagsFallbackBaseUrl()!,
            this.options.publicKey,
          );
          return;
        } catch (fallbackError) {
          if (!this.inited) {
            throw fallbackError;
          }
          console.error("Get list features flag:", fallbackError);
          return;
        }
      }

      if (!this.inited) {
        throw e;
      }

      console.error("Get list features flag:", e);
    }
  }

  private async syncFeaturesDeclarations() {
    if (!this.options.privateKey) return null;
    for (const [featureName, options] of Object.entries(this.featuresDeclarations)) {
      this.createFeature(featureName, options);
    }
  }

  private async syncFeaturesUsage() {
    if (!this.options.publicKey) {
      throw new Error(
        "Public key is missing. Please provide a valid publicKey in the SDK configuration.",
      );
    }
    const url = this.buildSdkUrl("/v1/sdk/feature/usages", this.getBaseUrl());

    fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: this.options.publicKey,
        privateKey: this.options.privateKey,
        usages: this.featuresUsage,
      }),
    }).catch((e) => console.error("Feature Usage Sync:", e));
  }
}
