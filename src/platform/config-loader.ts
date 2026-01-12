import { FlipFlagYaml } from "../types/provider";

export interface ConfigLoader {
  load(): Promise<FlipFlagYaml | null>;
}
