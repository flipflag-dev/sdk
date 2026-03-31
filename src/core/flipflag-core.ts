import {
  FlipFlagYaml,
  IDeclareFeatureOptions,
  IFeatureFlag,
  IFeatureFlagUsage,
  IManagerOptions,
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

  constructor(
    protected readonly opts: IManagerOptions,
    private readonly loader?: ConfigLoader,
  ) {
    this.options = {
      apiUrl: "https://api.flipflag.dev",
      pollingInterval: 30_000,
      syncInterval: 90_000,
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

  private async createFeature(
    featureName: string,
    options: IDeclareFeatureOptions,
  ) {
    if (!this.options.privateKey) return null;

    const url = new URL("/v1/sdk/feature", this.getBaseUrl());
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
      const url = new URL("/v1/sdk/feature/flags", this.getBaseUrl());
      url.searchParams.append("publicKey", this.options.publicKey);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok && !this.inited) {
        const errorText = await res.text();
        throw new Error(`Failed to get features: ${res.status} - ${errorText}`);
      }

      this.featuresFlags = await res.json();
    } catch (e) {
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
    const url = new URL("/v1/sdk/feature/usages", this.getBaseUrl());

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
