export interface IManagerOptions {
  apiUrl?: string;
  flagsFallbackApiUrl?: string;
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

  /**
   * Polling interval in milliseconds.
   * Default: 30000 (30 seconds)
   */
  pollingInterval?: number;

  /**
   * Sync interval in milliseconds (for syncing usage).
   * Default: 90000 (90 seconds)
   */
  syncInterval?: number;
}

export interface IDeclareFeatureOptions {
  contributor?: string;
  type?: string;
  description?: string;
}

export interface IFeatureFlag {
  enabled: boolean;
}

export interface IFeatureFlagUsage {
  featureName: string;
  usedAt: Date;
}

export type YamlFeature = {
  description?: string;
  contributor?: string;
  type?: string; // "feature" и т.п.
};

export type FlipFlagYaml = Record<string, YamlFeature>;

export type MetricEventType = 'assignment' | 'exposure' | 'metric';
export type MetricSubjectType = 'user' | 'device' | 'session' | 'org';

export interface IMetricEvent {
  eventId: string;
  experimentKey: string;
  variant: string;
  subjectType: MetricSubjectType;
  subjectId: string;
  eventType: MetricEventType;
  metricName?: string;
  value?: number;
  properties?: Record<string, unknown>;
  clientTs?: string;
}

export type ITrackEventParams = Omit<IMetricEvent, 'eventId' | 'eventType'>;
export type ITrackMetricParams = ITrackEventParams & { metricName: string };
