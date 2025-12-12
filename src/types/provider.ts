export interface IManagerOptions {
  apiUrl?: string;
  publicKey: string;
  privateKey?: string;

  /**
   * Path to flipflag yaml config.
   * Default: "<process.cwd()>/\\.flipflag.yml"
   */
  configPath?: string;

  /**
   * If true — ignore missing config file (no error).
   * Default: true
   */
  ignoreMissingConfig?: boolean;
}

export interface IDeclareFeatureTime {
  email: string;
  start: string;
  end?: string;
}

export interface IDeclareFeatureOptions {
  times: IDeclareFeatureTime[];
}

export interface IFeatureFlag {
  enabled: boolean;
}

export interface IFeatureFlagUsage {
  featureName: string;
  usedAt: Date;
}

export type YamlTime = { started: string; finished: string | null };

export type YamlFeature = {
  description?: string;
  contributor?: string;
  type?: string; // "feature" и т.п.
  times?: YamlTime[];
};

export type FlipFlagYaml = Record<string, YamlFeature>;
