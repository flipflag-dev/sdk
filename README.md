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
      times: [
        {
          started: "2025-12-01T00:00:00.000Z",
          finished: "2025-12-31T23:59:59.000Z",
        },
      ],
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
- ✅ **Time windows**: Define feature activation periods
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
      times: [
        {
          started: "2025-01-15T00:00:00.000Z",
          finished: null, // No end date
        },
      ],
    },
    legacyCheckout: {
      contributor: "payments-team@example.com",
      times: [
        {
          started: "2024-01-01T00:00:00.000Z",
          finished: "2025-03-01T00:00:00.000Z", // Will be disabled after this date
        },
      ],
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
    times: [
      {
        started: new Date().toISOString(),
        finished: null,
      },
    ],
  },
});

// Sync immediately
await manager.sync();
```

---

## 📝 YAML Configuration (Node.js)

The SDK automatically loads `.flipflag.yml` from your project root during `init()`.

### Basic Example

```yaml
newFeature:
  contributor: epolevov@emd.one
  times:
    - started: "2025-12-01T00:00:00.000Z"
      finished: "2025-12-31T23:59:59.000Z"

anotherFeature:
  contributor: dev@company.com
  times:
    - started: "2026-01-01T00:00:00.000Z"
      finished: null
```

### Advanced Example with Multiple Time Windows

```yaml
seasonalFeature:
  description: "Holiday sale banner"
  contributor: marketing@example.com
  type: "feature"
  times:
    # Black Friday 2025
    - started: "2025-11-24T00:00:00.000Z"
      finished: "2025-11-30T23:59:59.000Z"
    # Christmas 2025
    - started: "2025-12-20T00:00:00.000Z"
      finished: "2025-12-26T23:59:59.000Z"

betaFeature:
  description: "New analytics dashboard"
  contributor: analytics-team@example.com
  type: "experiment"
  times:
    - started: "2025-01-01T00:00:00.000Z"
      finished: null # No end date - always active
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
    times: [{ started: "2025-01-01T00:00:00.000Z", finished: null }],
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
- Clears cached flags and usage data

```ts
manager.destroy();
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
  times?: YamlTime[];
}

interface YamlTime {
  started: string; // ISO 8601 date string
  finished: string | null; // ISO 8601 date string or null for no end
}
```

### `IDeclareFeatureTime`

```ts
interface IDeclareFeatureTime {
  email: string;
  start: string; // ISO 8601 date string
  end?: string; // ISO 8601 date string
}
```

### `IFeatureFlag`

```ts
interface IFeatureFlag {
  enabled: boolean;
}
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

### Invalid date format

```
Error: FlipFlag: invalid "started" date in myFeature: not-a-date
```

**Solution**: Use ISO 8601 format for dates:

```yaml
myFeature:
  times:
    - started: "2025-01-01T00:00:00.000Z"  # ✅ Correct
    # - started: "2025-01-01"              # ❌ Wrong
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