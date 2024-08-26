import { Submodule } from "./main";
import * as core from "@actions/core";

export const toJson = (value: unknown): string => JSON.stringify(value);

export const toJsonPretty = (value: unknown): string =>
  JSON.stringify(value, null, 2);

export const logInfoAndDebug = (
  message: string,
  submodules: Submodule[]
): void => {
  const submodulePaths = submodules
    .map((submodule) => submodule.path)
    .join(", ");
  core.info(`${message}: [${submodulePaths}]`);
  core.debug(`${message}: ${toJsonPretty(submodules)}`);
};
