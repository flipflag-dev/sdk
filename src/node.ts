import { FlipFlagCore } from "./core/flipflag-core";
import { NodeConfigLoader } from "./platform/node/node-config-loader";
import { IManagerOptions } from "./types/provider";

export class FlipFlag extends FlipFlagCore {
  constructor(opts: IManagerOptions) {
    super(opts, new NodeConfigLoader(opts));
  }
}
