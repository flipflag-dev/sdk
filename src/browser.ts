import { FlipFlagCore } from "./core/flipflag-core";
import { IManagerOptions, FlipFlagYaml } from "./types/provider";

export class FlipFlag extends FlipFlagCore {
  constructor(opts: IManagerOptions, initialConfig?: FlipFlagYaml) {
    super(opts);
    if (initialConfig) this.declareFromObject(initialConfig);
  }
}
