import { Submodule } from "./main";
import * as core from "@actions/core";

export const toJson = (value: any, padding: number = 2): string =>
  JSON.stringify(value, null, padding);

export const log = (message: string, submodules: Submodule[]): void => {
  const submodulePaths = submodules
    .map((submodule) => submodule.path)
    .join(", ");
  core.info(`${message}: [${submodulePaths}]`);
  core.debug(`${message}: ${toJson(submodules)}`);
};
