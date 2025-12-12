import {
  FlipFlagYaml,
  IDeclareFeatureOptions,
  IDeclareFeatureTime,
  IFeatureFlag,
  IFeatureFlagUsage,
  IManagerOptions,
} from "./types/provider";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";

/**
 * Manager for interacting with FlipFlag.
 * Handles feature declaration, loading remote states, and periodic syncing.
 */
export class FlipFlag {
  /** Indicates whether initialization has completed */
  private inited = false;
  /** Interval handler for periodic feature refreshing */
  private interval: NodeJS.Timeout | null = null;
  /** Options passed to the manager (merged with defaults) */
  private options: Partial<IManagerOptions>;
  /**
   * Local cache of declared features times.
   * Keyed by feature name.
   */
  private featuresTimes: Record<string, IDeclareFeatureOptions> = {};
  /**
   * Local cache of declared features flags and their metadata.
   * Keyed by feature name.
   */
  private featuresFlags: Record<string, IFeatureFlag> = {};
  /**
   * Local cache of feature-flag usage events.
   * Each entry represents an interaction with a specific feature flag
   * (read, update, check) along with related metadata.
   */
  private featuresUsage: IFeatureFlagUsage[] = [];

  /**
   * @param opts Manager configuration (publicKey, privateKey, apiUrl, etc.)
   */
  constructor(protected readonly opts: IManagerOptions) {
    this.options = { apiUrl: "https://api.flipflag.dev", ...opts };
    this.interval = null;
  }

  /**
   * Initializes the manager:
   * - Loads the initial feature flags from the server
   * - Starts a 10-second polling loop to:
   *    • refresh feature flags
   *    • synchronize feature activation times
   */
  public async init() {
    await this.loadConfigFromYaml();
    await this.getFeaturesFlags();
    await this.syncFeaturesTimes();

    this.interval = setInterval(() => {
      this.getFeaturesFlags();
      this.syncFeaturesTimes();
      this.syncFeaturesUsage();
    }, 10_000);

    this.inited = true;
  }

  private async loadConfigFromYaml() {
    const configPath =
      this.options.configPath ?? path.resolve(process.cwd(), ".flipflag.yml");

    let raw: string;
    try {
      raw = await fs.readFile(configPath, "utf8");
    } catch (e: any) {
      if (e?.code === "ENOENT" && this.options.ignoreMissingConfig) return;
      throw new Error(
        `FlipFlag: cannot read config at ${configPath}: ${e?.message ?? e}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (e: any) {
      throw new Error(
        `FlipFlag: invalid YAML in ${configPath}: ${e?.message ?? e}`,
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `FlipFlag: YAML root must be an object (mapping featureName -> config)`,
      );
    }

    const doc = parsed as FlipFlagYaml;

    for (const [featureName, cfg] of Object.entries(doc)) {
      const times = (cfg?.times ?? []).map((t) => ({
        email: doc.contributor,
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

  /**
   * Destroys the manager:
   * - Stops the periodic sync
   * - Clears all locally declared features
   */
  public destroy() {
    this.inited = false;
    if (this.interval) clearInterval(this.interval);
    this.featuresTimes = {};
    this.featuresFlags = {};
    this.featuresUsage = [];
  }

  /**
   * Checks whether a feature is enabled.
   * If the feature does not exist locally, it will be created with empty options.
   *
   * @param featureName Name of the feature
   * @returns `true` if enabled, otherwise `false`
   */
  isEnabled(featureName: string) {
    const feature = this.getLocalFeatureFlag(featureName);

    if (!feature) {
      this.createFeature(featureName, { times: [] });

      return false;
    }

    this.upsertFeaturesUsage(featureName);

    return feature.enabled;
  }

  /**
   * Updates or inserts a feature usage record.
   * If the feature was already used before, its timestamp is updated.
   * Otherwise, a new usage entry is created.
   *
   * @param featureName - Name of the feature that was checked/used
   */
  private upsertFeaturesUsage(featureName: string) {
    const existing = this.featuresUsage.find(
      (u) => u.featureName === featureName,
    );

    if (existing) {
      existing.usedAt = new Date();
      return;
    }

    this.featuresUsage.push({
      featureName,
      usedAt: new Date(),
    });
  }

  /**
   * Creates a new feature on the server.
   * Requires a privateKey; otherwise the request is ignored.
   *
   * @param featureName Name of the feature
   * @param options Feature declaration options
   * @returns Created feature data or null if privateKey is missing
   */
  private async createFeature(
    featureName: string,
    options: IDeclareFeatureOptions,
  ) {
    if (!this.options.privateKey) {
      return null;
    }

    const baseUrl = this.getBaseUrl();
    const url = new URL("/v1/sdk/feature", baseUrl);

    fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        featureName,
        privateKey: this.options.privateKey,
        ...options,
      }),
    }).catch((error) => {
      console.error("Create Feature:", error);
    });
  }

  private getBaseUrl() {
    if (this.options.apiUrl) {
      return this.options.apiUrl.replace(/\/+$/, "");
    }

    throw new Error(
      "Base API URL is not configured. Please provide apiUrl in the SDK options.",
    );
  }

  /**
   * Fetches all features associated with the publicKey.
   * Populates the local `featuresTimes` cache.
   *
   * Throws an error only during initial initialization;
   * later polling failures are ignored.
   */
  private async getFeaturesFlags() {
    if (!this.options.publicKey) {
      throw new Error(
        "Public key is missing. Please provide a valid publicKey in the SDK configuration.",
      );
    }

    try {
      const baseUrl = this.getBaseUrl();
      const url = new URL("/v1/sdk/feature/flags", baseUrl);
      url.searchParams.append("publicKey", this.options.publicKey);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok && !this.inited) {
        const errorText = await response.text();
        throw new Error(
          `Failed to get features: ${response.status} - ${errorText}`,
        );
      }

      this.featuresFlags = await response.json();
    } catch (error) {
      console.error("Get list features flag:", error);
    }
  }

  /**
   * Fetches all features associated with the publicKey.
   * Populates the local `featuresTimes` cache.
   *
   * Throws an error only during initial initialization;
   * later polling failures are ignored.
   */
  private async syncFeaturesTimes() {
    if (!this.options.privateKey) {
      return null;
    }

    const list = Object.entries(this.featuresTimes);
    list.forEach(([featureName, options]: [string, IDeclareFeatureOptions]) => {
      this.createFeature(featureName, options);
    });
  }

  /**
   * Sends the collected feature usage data to the server.
   * Requires a valid `publicKey` provided in the SDK configuration.
   *
   * Throws an error if the `publicKey` is missing;
   * network or server errors during sync are not awaited or propagated.
   */
  private async syncFeaturesUsage() {
    if (!this.options.publicKey) {
      throw new Error(
        "Public key is missing. Please provide a valid publicKey in the SDK configuration.",
      );
    }

    const baseUrl = this.getBaseUrl();
    const url = new URL("/v1/sdk/feature/usages", baseUrl);

    fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publicKey: this.options.publicKey,
        usages: this.featuresUsage,
      }),
    }).catch((error) => {
      console.error("Feature Usage Sync:", error);
    });
  }

  /**
   * Returns a locally cached feature flag by name.
   *
   * @param featureName Name of the feature
   * @returns The feature or undefined if it does not exist
   */
  private getLocalFeatureFlag(featureName: string) {
    return this.featuresFlags[featureName];
  }
}
