# FlipFlag SDK

A lightweight, feature-rich client-side SDK for **FlipFlag** (https://flipflag.dev) — a powerful feature flag management platform.

The SDK is designed to be simple, declarative, and safe by default. It supports both browser and Node.js environments with automatic feature flag synchronization and usage tracking.

---

## 📦 Installation

```sh
npm install @flipflag/sdk
# or
yarn add @flipflag/sdk
# or
pnpm add @flipflag/sdk
```

---

## 🚀 Quick Start

### Node.js (with YAML config)

```ts
import { FlipFlag } from "@flipflag/sdk";

const manager = new FlipFlag({
  publicKey: "YOUR_PUBLIC_KEY",
  privateKey: "YOUR_PRIVATE_KEY", // optional (read-only mode without it)
});

await manager.init();

if (manager.isEnabled("newFeature")) {
  console.log("Feature is enabled!");
}
```

### Browser (with inline config)

```ts
import { FlipFlag } from "@flipflag/sdk";

const manager = new FlipFlag(
  {
    publicKey: "YOUR_PUBLIC_KEY",
    privateKey: "YOUR_PRIVATE_KEY",
  },
  {
    // Initial configuration
    newFeature: {
      contributor: "dev@example.com",
    },
  }
);

await manager.init();
```

---

## 🎯 Features

- ✅ **Dual environment support**: Node.js and Browser
- ✅ **Read-only mode**: Use only `publicKey` to fetch flags
- ✅ **Full management**: Use `privateKey` to declare features and track usage
- ✅ **YAML configuration**: Declarative feature definitions (Node.js)
- ✅ **Programmatic API**: Declare features via code (Browser)
- ✅ **Auto-sync**: Periodic polling for flags and statistics
- ✅ **Usage tracking**: Automatic feature usage analytics
- ✅ **Experiment metrics**: Track assignments, exposures, and custom metric events
- ✅ **TypeScript**: Full type safety out of the box
- ✅ **Lightweight**: Minimal dependencies

---

## 📚 Configuration Options

### `IManagerOptions`

```ts
interface IManagerOptions {
  /**
   * FlipFlag API base URL.
   * @default "https://api.flipflag.dev"
   */
  apiUrl?: string;

  /**
   * Optional backup API base URL used only for GET /v1/sdk/feature/flags.
   * Write operations always stay on apiUrl.
   */
  flagsFallbackApiUrl?: string;

  /**
   * Public key for fetching feature flags (required).
   * Get it from your FlipFlag project settings.
   */
  publicKey: string;

  /**
   * Private key for declaring features and syncing usage (optional).
   * Without it, SDK works in read-only mode.
   */
  privateKey?: string;

  /**
   * Path to .flipflag.yml config file (Node.js only).
   * @default "<process.cwd()>/.flipflag.yml"
   */
  configPath?: string;

  /**
   * If true, missing config file won't throw an error.
   * @default true
   */
  ignoreMissingConfig?: boolean;

  /**
   * Polling interval for fetching feature flags (milliseconds).
   * @default 30000 (30 seconds)
   */
  pollingInterval?: number;

  /**
   * Sync interval for sending declarations and usage stats (milliseconds).
   * @default 90000 (90 seconds)
   */
  syncInterval?: number;
}
```

---

## 📖 Usage Examples

### Read-Only Mode (Public Key Only)

Perfect for client-side applications where you only need to check feature states:

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
});

await manager.init();

// Check feature state
if (manager.isEnabled("darkMode")) {
  enableDarkMode();
}

// Cleanup when done
manager.destroy();
```

### Full Mode (with Private Key)

For applications that manage features and track usage:

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  privateKey: "priv_xxxxxxxxxxxxx",
});

await manager.init();

// Features will be automatically declared from .flipflag.yml
// and usage will be tracked
```

### Custom Intervals

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  pollingInterval: 10_000,  // Check flags every 10 seconds
  syncInterval: 60_000,     // Sync usage every 60 seconds
});
```

### Backup Flags Endpoint

Use a separate backup base URL only for reading flags when the primary SDK API is temporarily unavailable:

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  privateKey: "priv_xxxxxxxxxxxxx",
  apiUrl: "https://api.flipflag.dev",
  flagsFallbackApiUrl: "https://sdk-backup.flipflag.dev",
});
```

The SDK falls back to `flagsFallbackApiUrl` only for `GET /v1/sdk/feature/flags` and only on network errors or `5xx` responses. `401`, `403`, and other client errors still come from the primary API and are not retried against backup.

### Manual Sync

Force immediate synchronization without waiting for intervals:

```ts
await manager.init();

// ... some time later
await manager.sync(); // Syncs declarations and usage immediately
```

### Browser Usage with Programmatic Configuration

```ts
import { FlipFlag } from "@flipflag/sdk";

const manager = new FlipFlag(
  {
    publicKey: "pub_xxxxxxxxxxxxx",
    privateKey: "priv_xxxxxxxxxxxxx",
  },
  {
    newPaymentFlow: {
      description: "New Stripe integration",
      contributor: "payments-team@example.com",
      type: "feature",
    },
    legacyCheckout: {
      contributor: "payments-team@example.com",
    },
  }
);

await manager.init();
```

### Dynamic Feature Declaration

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  privateKey: "priv_xxxxxxxxxxxxx",
});

await manager.init();

// Add features programmatically
manager.declareFromObject({
  experimentalUI: {
    contributor: "ui-team@example.com",
  },
});

// Sync immediately
await manager.sync();
```

### Experiment Metrics

Track experiment assignments, exposures, and custom metric events. Events are buffered in memory and automatically flushed every `syncInterval` (default 90s) or immediately when the buffer reaches 500 events.

Requires `privateKey`.

#### Track Assignment

Record when a subject is assigned to a variant:

```ts
manager.trackAssignment({
  experimentKey: "checkout-flow-v2",
  variant: "control",
  subjectType: "user",
  subjectId: "user_123",
});
```

#### Track Exposure

Record when a subject actually sees the variant (e.g. when the UI renders):

```ts
manager.trackExposure({
  experimentKey: "checkout-flow-v2",
  variant: "treatment",
  subjectType: "user",
  subjectId: "user_123",
});
```

#### Track Metric

Record a custom metric event. `metricName` is required:

```ts
// Conversion event (value defaults to 1)
manager.trackMetric({
  experimentKey: "checkout-flow-v2",
  variant: "treatment",
  subjectType: "user",
  subjectId: "user_123",
  metricName: "purchase_completed",
});

// Revenue metric with numeric value
manager.trackMetric({
  experimentKey: "checkout-flow-v2",
  variant: "treatment",
  subjectType: "user",
  subjectId: "user_123",
  metricName: "revenue",
  value: 49.99,
  properties: { currency: "USD", plan: "pro" },
});
```

#### Subject Types

| Value | Description |
|---|---|
| `"user"` | Authenticated user |
| `"device"` | Anonymous device |
| `"session"` | Browser/app session |
| `"org"` | Organization / workspace |

---

## 📝 YAML Configuration (Node.js)

The SDK automatically loads `.flipflag.yml` from your project root during `init()`.

### Basic Example

```yaml
newFeature:
  contributor: epolevov@emd.one

anotherFeature:
  contributor: dev@company.com
```

### Advanced Example

```yaml
seasonalFeature:
  description: "Holiday sale banner"
  contributor: marketing@example.com
  type: "feature"

betaFeature:
  description: "New analytics dashboard"
  contributor: analytics-team@example.com
  type: "experiment"
```

### Custom Config Path

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  configPath: "./config/features.yml",
});
```

---

## 🔌 API Reference

### `FlipFlag` Class

#### Constructor

```ts
// Node.js
new FlipFlag(options: IManagerOptions)

// Browser
new FlipFlag(options: IManagerOptions, initialConfig?: FlipFlagYaml)
```

#### Methods

##### `init(): Promise<void>`

Initializes the SDK:
- Loads YAML config (Node.js only)
- Fetches current feature flags from server
- Syncs declared features
- Starts automatic polling and sync intervals

```ts
await manager.init();
```

##### `isEnabled(featureName: string): boolean`

Checks if a feature is enabled. Also:
- Tracks usage automatically
- Creates feature on server if it doesn't exist (requires `privateKey`)

```ts
if (manager.isEnabled("darkMode")) {
  // Feature is enabled
}
```

##### `declareFromObject(config: FlipFlagYaml): void`

Programmatically declares features without YAML file.

```ts
manager.declareFromObject({
  myFeature: {
    contributor: "dev@example.com",
  },
});
```

##### `sync(): Promise<void>`

Manually triggers synchronization:
- Syncs feature declarations
- Sends usage statistics

```ts
await manager.sync();
```

##### `destroy(): void`

Stops all timers and clears local state:
- Stops polling interval
- Stops sync interval
- Clears cached flags, usage data, and metrics queue

```ts
manager.destroy();
```

##### `trackAssignment(params: ITrackEventParams): void`

Records an assignment event — when a subject is assigned to a variant.

```ts
manager.trackAssignment({
  experimentKey: "my-experiment",
  variant: "control",
  subjectType: "user",
  subjectId: "user_123",
  properties: { source: "onboarding" }, // optional
});
```

##### `trackExposure(params: ITrackEventParams): void`

Records an exposure event — when a subject actually sees the variant.

```ts
manager.trackExposure({
  experimentKey: "my-experiment",
  variant: "treatment",
  subjectType: "user",
  subjectId: "user_123",
});
```

##### `trackMetric(params: ITrackMetricParams): void`

Records a custom metric event. `metricName` is required. `value` defaults to `1` on the server if omitted.

```ts
manager.trackMetric({
  experimentKey: "my-experiment",
  variant: "treatment",
  subjectType: "user",
  subjectId: "user_123",
  metricName: "revenue",
  value: 29.99,
  properties: { plan: "pro" }, // optional
});
```

---

## 🎨 TypeScript Types

### `FlipFlagYaml`

```ts
type FlipFlagYaml = Record<string, YamlFeature>;

interface YamlFeature {
  description?: string;
  contributor?: string;
  type?: string;
}
```

### `IFeatureFlag`

```ts
interface IFeatureFlag {
  enabled: boolean;
}
```

### `IMetricEvent`

```ts
type MetricEventType = 'assignment' | 'exposure' | 'metric';
type MetricSubjectType = 'user' | 'device' | 'session' | 'org';

interface IMetricEvent {
  eventId: string;           // auto-generated by SDK
  experimentKey: string;
  variant: string;
  subjectType: MetricSubjectType;
  subjectId: string;
  eventType: MetricEventType;
  metricName?: string;       // required for eventType = 'metric'
  value?: number;
  properties?: Record<string, unknown>;
  clientTs?: string;         // auto-set by SDK (ISO 8601)
}
```

### `ITrackEventParams` / `ITrackMetricParams`

```ts
// For trackAssignment() and trackExposure()
type ITrackEventParams = Omit<IMetricEvent, 'eventId' | 'eventType'>;

// For trackMetric() — metricName is required
type ITrackMetricParams = ITrackEventParams & { metricName: string };
```

---

## 💡 Best Practices

### 1. Use Environment Variables

```ts
const manager = new FlipFlag({
  publicKey: process.env.FLIPFLAG_PUBLIC_KEY!,
  privateKey: process.env.FLIPFLAG_PRIVATE_KEY,
});
```

### 2. Initialize Early

```ts
// app.ts
const manager = new FlipFlag({ /* ... */ });
await manager.init();

// Now use throughout your app
export { manager };
```

### 3. Cleanup on Shutdown

```ts
process.on("SIGTERM", () => {
  manager.destroy();
  process.exit(0);
});
```

### 4. Use Read-Only Mode in Production Frontend

For security, only use `publicKey` in client-side production code:

```ts
// ✅ Good - read-only
const manager = new FlipFlag({
  publicKey: import.meta.env.VITE_FLIPFLAG_PUBLIC_KEY,
});

// ❌ Bad - exposes private key
const manager = new FlipFlag({
  publicKey: import.meta.env.VITE_FLIPFLAG_PUBLIC_KEY,
  privateKey: import.meta.env.VITE_FLIPFLAG_PRIVATE_KEY, // Don't do this!
});
```

### 5. Handle Initialization Errors

```ts
try {
  await manager.init();
} catch (error) {
  console.error("Failed to initialize FlipFlag:", error);
  // Fallback to default behavior
}
```

### 6. Use Feature Flags Defensively

```ts
// Default to false if something goes wrong
const isEnabled = manager?.isEnabled("newFeature") ?? false;
```

---

## 🔧 Troubleshooting

### Config file not found

```
Error: FlipFlag: cannot read config at /path/to/.flipflag.yml: ENOENT
```

**Solution**: Set `ignoreMissingConfig: true` or create the config file:

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx",
  ignoreMissingConfig: true,
});
```

### Public key missing

```
Error: Public key is missing. Please provide a valid publicKey in the SDK configuration.
```

**Solution**: Always provide a `publicKey`:

```ts
const manager = new FlipFlag({
  publicKey: "pub_xxxxxxxxxxxxx", // Required!
});
```

### Features not syncing

If features declared in YAML aren't appearing on the server:

1. Check that you provided `privateKey` (read-only mode can't create features)
2. Check network connectivity to FlipFlag API
3. Verify your API keys are correct
4. Check browser/server console for errors

---

## 🌐 Platform Compatibility

- **Node.js**: v16+ (ESM and CommonJS)
- **Browsers**: Modern browsers with `fetch` API support
- **TypeScript**: 4.5+

---

## 📦 Package Exports

The package provides optimized builds for different environments:

```json
{
  "exports": {
    ".": {
      "types": "./dist/browser.d.ts",
      "browser": "./dist/browser.js",
      "node": "./dist/node.js",
      "default": "./dist/browser.js"
    }
  }
}
```

Node.js automatically uses the Node-specific build with filesystem support, while browsers get the lightweight browser build.

---

## 🔗 Links

- **Website**: https://flipflag.dev
- **Documentation**: https://docs.flipflag.dev
- **GitHub**: https://github.com/flipflag-dev/sdk
- **NPM**: https://www.npmjs.com/package/@flipflag/sdk
- **Issues**: https://github.com/flipflag-dev/sdk/issues

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ by the FlipFlag team**
