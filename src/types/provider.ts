export interface IManagerOptions {
  apiUrl?: string;
  publicKey: string;
  privateKey?: string;
}

export interface IDeclareFeatureTime {
  email: string;
  start: Date;
  end?: Date;
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
