// src/platform/node/node-config-loader.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { FlipFlagYaml, IManagerOptions } from "../../types/provider";
import { ConfigLoader } from "../config-loader";

export class NodeConfigLoader implements ConfigLoader {
  constructor(private options: Partial<IManagerOptions>) {}

  async load(): Promise<FlipFlagYaml | null> {
    const configPath =
      this.options.configPath ?? path.resolve(process.cwd(), ".flipflag.yml");

    let raw: string;
    try {
      raw = await fs.readFile(configPath, "utf8");
    } catch (e: any) {
      if (e?.code === "ENOENT" && this.options.ignoreMissingConfig) return null;
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
      console.warn(
        "FlipFlag: YAML root must be an object (mapping featureName -> config)",
      );
      return null;
    }

    return parsed as FlipFlagYaml;
  }
}
