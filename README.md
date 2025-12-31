# FlipFlag SDK

A lightweight client-side SDK for working with **FlipFlag**.

The SDK is designed to be simple, declarative, and safe by default.  
It supports read-only usage as well as full feature management when a private key is provided.

---

## Features

- Load feature flags (`enabled`) using a **public key**
- Declare feature activation windows via `.flipflag.yml`
- Automatically create features on the server (requires `privateKey`)
- Periodically sync:
  - feature flags
  - feature timing declarations
  - feature usage events
- Local in-memory cache for flags, declarations, and usage
- Full TypeScript support

---

## Installation

```sh
npm install @flipflag/sdk
# or
yarn add @flipflag/sdk
```

---

## Quick Start

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

---

## Configuration via `.flipflag.yml`

By default, the SDK looks for a `.flipflag.yml` file in the project root  
(`process.cwd()`), which is loaded during `init()`.

### Example `.flipflag.yml`

```yml
newFeature:
  contributor: epolevov@emd.one
  times:
    - started: "2025-12-01T00:00:00.000Z"
      finished: "2025-12-31T23:59:59.000Z"

anotherFeature:
  contributor: dev@company.com
  times:
    - started: "2026-01-01T00:00:00.000Z"
```

---

## Checking Feature State

```ts
manager.isEnabled("newFeature");
```

---

## Automatic Syncing

After calling `init()`, the SDK starts a **10-second polling loop**.

To stop syncing and clear all local state:

```ts
manager.destroy();
```

---

## Manager Options

```ts
export interface IManagerOptions {
  apiUrl?: string;
  publicKey: string;
  privateKey?: string;
  configPath?: string;
  ignoreMissingConfig?: boolean;
}
```

---

## License

MIT License
