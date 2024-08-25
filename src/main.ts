import { exec, getExecOutput } from "@actions/exec";
import * as core from "@actions/core";
import * as fs from "node:fs/promises";
import { log as logInfoAndDebug, toJson } from "./logging";
import { multiplePrBody, singlePrBody } from "./markdown";

type GAMatrix = {
  name: string[];
  include: SubmoduleWithLatestTag[];
};

export type Submodule = {
  name: string;
  path: string;
  url: string;
  previousTag?: string;
};

export type SubmoduleWithLatestTag = Submodule & {
  latestTag: string;
};

type ReadFileOutput = {
  exitCode: number;
  err: string;
  contents: string;
};

const readFile = async (path: string): Promise<ReadFileOutput> => {
  let err = "";

  try {
    const contents = await fs.readFile(path, "utf8");
    return { exitCode: 0, err: "", contents };
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        err = `File not found: ${path}`;
        return { exitCode: 1, err, contents: "" };
      }
      err = `Error reading file: ${error.message}`;
    } else {
      err = "An unknown error occurred while reading the file";
    }
    return { exitCode: 1, err, contents: "" };
  }
};

export const getTag = async (path: string): Promise<string> => {
  core.info(`Fetching tag for: ${path}`);
  const options = { cwd: path };
  return (
    await getExecOutput("git describe --abbrev=0 --tags", [], options)
  ).stdout.trim();
};

export const getPreviousTag = async (
  path: string
): Promise<string | undefined> => {
  try {
    return await getTag(path);
  } catch (error) {
    core.info(`'${path}': Submodule has no tags. Continuing...`);
    return undefined;
  }
};

export const parseGitModules = async (
  content: string
): Promise<Submodule[]> => {
  const gitmodulesRegex =
    /^\s*\[submodule\s+"([^"]+)"\]\s*\n\s*path\s*=\s*(.+)\s*\n\s*url\s*=\s*(.+)\s*$/gm;

  const rawSubmodules = Array.from(content.matchAll(gitmodulesRegex)).map(
    ([_, name, path, url]) => {
      return {
        name,
        path,
        url,
        previousTag: "",
      } as Submodule;
    }
  );

  logInfoAndDebug("Parsed submodules", rawSubmodules);

  const submodules = rawSubmodules.map(async (submodule) => {
    const previousTag = await getPreviousTag(submodule.path);
    return { ...submodule, previousTag } as Submodule;
  });

  return await Promise.all(submodules);
};

export const filterSubmodules = async (
  inputSubmodules: string,
  detectedSubmodules: Submodule[]
): Promise<Submodule[]> => {
  // We only want to update the submodules that actually have an existing tag
  const validSubmodules = detectedSubmodules.filter(
    (submodule) => submodule.previousTag
  );

  if (!inputSubmodules) {
    return validSubmodules;
  }

  // Github Actions doesn't support array inputs, so the submodules are passed as a string with each submodule in a new line
  const parsedInputSubmodules = inputSubmodules
    .trim()
    .split("\n")
    .map((submodule) => submodule.trim().replace(/"/g, ""));
  core.debug(`Input submodules: ${toJson(parsedInputSubmodules)}`);

  // We only want to update the submodules that the user has specified from the detected submodules
  return validSubmodules.filter((submodule) =>
    parsedInputSubmodules.some((parsed) => parsed === submodule.path)
  );
};

export const updateSubmodules = async (
  filteredSubmodules: Submodule[]
): Promise<Submodule[]> => {
  const paths = filteredSubmodules.map((submodule) => submodule.path);

  const { stdout } = await getExecOutput(
    "git submodule update --remote",
    paths
  );
  if (stdout.trim() === "") {
    return [];
  }

  // Parse the updated submodules from the git output
  // ASSUMPTION: The first set of single quotes is the submodule path
  const updatedSubmodules = stdout
    .trim()
    .split("\n")
    .map((line) => line.split("'")[1]);
  core.debug(`Submodules parsed from git output: ${toJson(updatedSubmodules)}`);

  // We only want to update the submodules that actually have new commits
  return filteredSubmodules.filter((submodule) => {
    return updatedSubmodules.some((updated) => updated === submodule.path);
  });
};

export const updateToLatestTag = async (
  updatedSubmodules: Submodule[]
): Promise<SubmoduleWithLatestTag[]> => {
  const submodulesWithTag = updatedSubmodules.map(async (submodule) => {
    const options = { cwd: submodule.path };
    const latestTag = await getTag(submodule.path);
    await exec(`git reset --hard`, [latestTag], options);
    return { ...submodule, latestTag } as SubmoduleWithLatestTag;
  });

  return await Promise.all(submodulesWithTag);
};

const setDynamicOutputs = (
  prefix: string,
  submodule: SubmoduleWithLatestTag
) => {
  core.setOutput(`${prefix}--path`, submodule.path);
  core.setOutput(`${prefix}--url`, submodule.url);
  core.setOutput(`${prefix}--previousTag`, submodule.previousTag);
  core.setOutput(`${prefix}--latestTag`, submodule.latestTag);
  core.setOutput(`${prefix}--prBody`, singlePrBody(submodule));
};

const generateGAMatrix = (submodules: SubmoduleWithLatestTag[]): string => {
  return toJson(
    {
      name: submodules.map((submodule) => submodule.name),
      include: submodules,
    } as GAMatrix,
    0
  );
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const gitModulesPath = core.getInput("gitmodulesPath");
    const inputSubmodules = core.getInput("submodules");

    const gitModulesOutput = await readFile(gitModulesPath);
    if (gitModulesOutput.exitCode !== 0) {
      core.setFailed(gitModulesOutput.err);
      return;
    }
    if (gitModulesOutput.contents === "") {
      core.info("No submodules detected.");
      core.info("Nothing to do. Exiting...");
      return;
    }

    const detectedSubmodules = await parseGitModules(gitModulesOutput.contents);
    logInfoAndDebug("Detected Submodules", detectedSubmodules);

    const filteredSubmodules = await filterSubmodules(
      inputSubmodules,
      detectedSubmodules
    );
    logInfoAndDebug("Submodules to update", filteredSubmodules);

    const updatedSubmodules = await updateSubmodules(filteredSubmodules);
    if (updatedSubmodules.length === 0) {
      core.info("All submodules have no new remote commits.");
      core.info("Nothing to do. Exiting...");
      return;
    }
    logInfoAndDebug("Fetched remote commits for", updatedSubmodules);

    const submodulesAtLatestTag = await updateToLatestTag(updatedSubmodules);

    core.setOutput("json", toJson(submodulesAtLatestTag, 0));
    core.setOutput("matrix", generateGAMatrix(submodulesAtLatestTag));
    core.setOutput("prBody", multiplePrBody(submodulesAtLatestTag));
    for (const submodule of submodulesAtLatestTag) {
      setDynamicOutputs(submodule.name, submodule);
      if (submodule.name !== submodule.path) {
        setDynamicOutputs(submodule.path, submodule);
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
