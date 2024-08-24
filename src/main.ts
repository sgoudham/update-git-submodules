import { exec, getExecOutput } from "@actions/exec";
import * as core from "@actions/core";
import * as fs from "node:fs/promises";
import { log, toJson } from "./logging";

type GAMatrix = {
  name: string[];
  include: SubmoduleWithLatestTag[];
};

export type Submodule = {
  name: string;
  path: string;
  url: string;
  previousTag: string;
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

export const parseGitModules = async (
  content: string
): Promise<Submodule[]> => {
  const gitmodulesRegex =
    /^\s*\[submodule\s+"([^"]+)"\]\s*\n\s*path\s*=\s*(.+)\s*\n\s*url\s*=\s*(.+)\s*$/gm;

  const rawSubmodules = Array.from(content.matchAll(gitmodulesRegex)).map(
    ([_, name, path, url]) => {
      return {
        name: name,
        path: path,
        url: url,
      };
    }
  );

  const submodules = rawSubmodules.map(async (submodule) => {
    const previousTag = await getTag(submodule.path);
    return { ...submodule, previousTag } as Submodule;
  });

  return await Promise.all(submodules);
};

export const filterSubmodules = async (
  inputSubmodules: string,
  detectedSubmodules: Submodule[]
): Promise<Submodule[]> => {
  if (!inputSubmodules) {
    return detectedSubmodules;
  }

  // Github Actions doesn't support array inputs, so the submodules are passed as a string with each submodule in a new line
  const parsedInputSubmodules = inputSubmodules
    .trim()
    .split("\n")
    .map((submodule) => submodule.trim().replace(/"/g, ""));
  core.debug(`Input submodules: ${toJson(parsedInputSubmodules)}`);

  // We only want to update the submodules that the user has specified from the detected submodules
  return detectedSubmodules.filter((submodule) =>
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

const generatePrTable = (submodules: SubmoduleWithLatestTag[]) => {
  const header =
    "| **Submodule Name** | **Submodule Path** | **Change** |\n| --- | --- | --- |";
  const body = submodules
    .map((submodule) => {
      const name = `[${submodule.name}](${submodule.url})`;
      const cleanUrl = submodule.url.replace(".git", "");
      const changeTagDisplay = `${submodule.previousTag}...${submodule.latestTag}`;
      const changeUrl = `[${changeTagDisplay}](${cleanUrl}/compare/${changeTagDisplay})`;
      return `| ${name} | ${submodule.path} | ${changeUrl} |`;
    })
    .join("\n");
  return `${header}\n${body}`;
};

const generatePrBody = (submodules: SubmoduleWithLatestTag[]) => {
  const header = "This PR updates the following submodules:";
  const body = generatePrTable(submodules);
  const footer =
    "---\n\nThis PR was generated by [sgoudham/update-git-submodules](https://github.com/sgoudham/update-git-submodules).";
  return `${header}\n${body}\n${footer}`;
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
    log("Detected submodules", detectedSubmodules);

    const filteredSubmodules = await filterSubmodules(
      inputSubmodules,
      detectedSubmodules
    );
    log("Submodules to update", filteredSubmodules);

    const updatedSubmodules = await updateSubmodules(filteredSubmodules);
    if (updatedSubmodules.length === 0) {
      core.info("All submodules have no new remote commits.");
      core.info("Nothing to do. Exiting...");
      return;
    }
    log("Updated submodules", updatedSubmodules);

    const submodulesAtLatestTag = await updateToLatestTag(updatedSubmodules);

    core.setOutput("json", toJson(submodulesAtLatestTag, 0));
    core.setOutput("matrix", generateGAMatrix(submodulesAtLatestTag));
    core.setOutput("prBody", generatePrBody(submodulesAtLatestTag));
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
