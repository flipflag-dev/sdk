import {
  FlipFlagYaml,
  IDeclareFeatureOptions,
  IDeclareFeatureTime,
  IFeatureFlag,
  IFeatureFlagUsage,
  IManagerOptions,
} from "../types/provider";
import { ConfigLoader } from "../platform/config-loader";

export class FlipFlagCore {
  private inited = false;
  private interval: any = null;

  protected options: Partial<IManagerOptions>;
  private featuresTimes: Record<string, IDeclareFeatureOptions> = {};
  private featuresFlags: Record<string, IFeatureFlag> = {};
  private featuresUsage: IFeatureFlagUsage[] = [];

  constructor(
    protected readonly opts: IManagerOptions,
    private readonly loader?: ConfigLoader,
  ) {
    this.options = {
      apiUrl: "https://api.flipflag.dev",
      pollingInterval: 30_000,
      ...opts,
    };
  }

  public async init() {
    if (this.loader) {
      const yamlDoc = await this.loader.load();
      if (yamlDoc) this.applyYamlConfig(yamlDoc);
    }

    await this.getFeaturesFlags();
    await this.syncFeaturesTimes();

    this.interval = setInterval(() => {
      this.getFeaturesFlags();
      this.syncFeaturesTimes();
      this.syncFeaturesUsage();
    }, this.options.pollingInterval);

    this.inited = true;
  }

  public destroy() {
    this.inited = false;
    if (this.interval) clearInterval(this.interval);
    this.featuresTimes = {};
    this.featuresFlags = {};
    this.featuresUsage = [];
  }

  public isEnabled(featureName: string) {
    const feature = this.featuresFlags[featureName];
    if (!feature) {
      this.createFeature(featureName, { times: [] });
      return false;
    }
    this.upsertFeaturesUsage(featureName);
    return feature.enabled;
  }

  public declareFromObject(doc: FlipFlagYaml) {
    this.applyYamlConfig(doc);
  }

  public async sync() {
    await this.syncFeaturesTimes();
    await this.syncFeaturesUsage();
  }

  private applyYamlConfig(doc: FlipFlagYaml) {
    for (const [featureName, cfg] of Object.entries(doc)) {
      const times = (cfg?.times ?? []).map((t) => ({
        email: doc[featureName].contributor,
        start: t.started,
        end: t.finished ?? null,
      })) as IDeclareFeatureTime[];

      for (const t of times) {
        if (Number.isNaN(Date.parse(t.start))) {
          throw new Error(
            `FlipFlag: invalid "started" date in ${featureName}: ${t.start}`,
          );
        }
        if (t.end !== null && Number.isNaN(Date.parse(String(t.end)))) {
          throw new Error(
            `FlipFlag: invalid "finished" date in ${featureName}: ${t.end}`,
          );
        }
      }

      this.featuresTimes[featureName] = { times };
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

  private async syncFeaturesTimes() {
    if (!this.options.privateKey) return null;
    for (const [featureName, options] of Object.entries(this.featuresTimes)) {
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
