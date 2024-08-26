import { exec, getExecOutput } from "@actions/exec";
import * as core from "@actions/core";
import * as fs from "node:fs/promises";
import { logInfoAndDebug, toJson, toJsonPretty } from "./logging";
import { multiplePrBody, singlePrBody } from "./markdown";
import { z } from "zod";
import { getCommit, getPreviousTag, getTag } from "./git";

const updateStrategy = z.enum(["commit", "tag"]);
type UpdateStrategy = z.infer<typeof updateStrategy>;

export type Inputs = {
  gitmodulesPath: string;
  inputSubmodules: string[];
  strategy: UpdateStrategy;
};

type GAMatrix = {
  name: string[];
  include: Submodule[];
};

export type Submodule = {
  name: string;
  path: string;
  url: string;
  previousShortCommitSha: string;
  previousCommitSha: string;
  previousTag?: string;
  latestShortCommitSha: string;
  latestCommitSha: string;
  latestTag?: string;
};

export type UpdatedSubmodule = {
  path: string;
  shortCommitSha: string;
  commitSha: string;
};

export const parseInputs = async (): Promise<Inputs> => {
  const gitmodulesPath = core.getInput("gitmodulesPath").trim();
  const inputSubmodules = core.getInput("submodules").trim();
  const strategy = await updateStrategy.parseAsync(core.getInput("strategy"));

  // Github Actions doesn't support array inputs, so submodules must be separated by newlines
  const parsedSubmodules = inputSubmodules
    .split("\n")
    .map((submodule) => submodule.trim().replace(/"/g, ""));
  core.debug(`Input submodules: ${toJsonPretty(parsedSubmodules)}`);

  return {
    gitmodulesPath,
    inputSubmodules: inputSubmodules === "" ? [] : parsedSubmodules,
    strategy,
  };
};

const readFile = async (path: string): Promise<string> => {
  return await fs.readFile(path, "utf8").catch((error) => {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        core.setFailed(`File not found: ${path}`);
      } else {
        core.setFailed(`Error reading file: ${error.message}`);
      }
    } else {
      core.setFailed("An unknown error occurred while reading the file");
    }
    throw error;
  });
};

export const parseGitmodules = async (
  content: string
): Promise<Submodule[]> => {
  const gitmodulesRegex =
    /^\s*\[submodule\s+"([^"]+)"\]\s*\n\s*path\s*=\s*(.+)\s*\n\s*url\s*=\s*(.+)\s*$/gm;

  const parsedContent = Array.from(content.matchAll(gitmodulesRegex));
  const detectedSubmodules: Submodule[] = await Promise.all(
    parsedContent.map(async ([_, name, path, url]) => {
      const [previousCommitSha, previousShortCommitSha] = await getCommit(path);
      const previousTag = await getPreviousTag(path);
      return {
        name,
        path,
        url,
        previousShortCommitSha,
        previousCommitSha,

        // The latest commit should be updated after the submodule is updated
        // If you think about it, the "previous" commit is the latest commit too
        latestShortCommitSha: previousShortCommitSha,
        latestCommitSha: previousCommitSha,

        previousTag,
      };
    })
  );

  return detectedSubmodules;
};

export const filterSubmodules = async (
  inputSubmodules: string[],
  detectedSubmodules: Submodule[],
  strategy: UpdateStrategy
): Promise<Submodule[]> => {
  let validSubmodules = detectedSubmodules;
  if (strategy === "tag") {
    validSubmodules = detectedSubmodules.filter(
      (submodule) => submodule.previousTag
    );
  }

  if (inputSubmodules.length === 0) {
    return validSubmodules;
  }

  return validSubmodules.filter((submodule) =>
    inputSubmodules.some((input) => input === submodule.path)
  );
};

export const updateToLatestCommit = async (
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
  // ASSUMPTION: The second set of single quotes is the commit sha
  const updatedSubmodules: UpdatedSubmodule[] = stdout
    .trim()
    .split("\n")
    .map((line) => {
      const path = line.split("'")[1];
      const commitSha = line.split("'")[3];
      return {
        path,
        commitSha,
        shortCommitSha: commitSha.substring(0, 7),
      };
    });
  core.debug(
    `Submodules parsed from git output: ${toJsonPretty(updatedSubmodules)}`
  );

  for (const { path, shortCommitSha, commitSha } of updatedSubmodules) {
    const submodule = filteredSubmodules.find(
      (submodule) => submodule.path === path
    );
    if (submodule) {
      submodule.latestShortCommitSha = shortCommitSha;
      submodule.latestCommitSha = commitSha;
    }
  }

  // We only want to update the submodules that actually have new commits
  return filteredSubmodules.filter((submodule) => {
    return updatedSubmodules.some((updated) => updated.path === submodule.path);
  });
};

export const updateToLatestTag = async (
  updatedSubmodules: Submodule[]
): Promise<Submodule[]> => {
  const submodulesWithTag = updatedSubmodules.map(async (submodule) => {
    const options = { cwd: submodule.path };
    const latestTag = await getTag(submodule.path);
    await exec(`git reset --hard`, [latestTag], options);
    return { ...submodule, latestTag } as Submodule;
  });

  return await Promise.all(submodulesWithTag);
};

export const setDynamicOutputs = (prefix: string, submodule: Submodule) => {
  core.setOutput(`${prefix}--updated`, true);
  core.setOutput(`${prefix}--path`, submodule.path);
  core.setOutput(`${prefix}--url`, submodule.url);
  core.setOutput(
    `${prefix}--previousShortCommitSha`,
    submodule.previousShortCommitSha
  );
  core.setOutput(`${prefix}--previousCommitSha`, submodule.previousCommitSha);
  core.setOutput(
    `${prefix}--latestShortCommitSha`,
    submodule.latestShortCommitSha
  );
  core.setOutput(`${prefix}--latestCommitSha`, submodule.latestCommitSha);
  core.setOutput(`${prefix}--previousTag`, submodule.previousTag ?? "");
  core.setOutput(`${prefix}--latestTag`, submodule.latestTag ?? "");
  core.setOutput(`${prefix}--prBody`, singlePrBody(submodule));
};

const toJsonMatrix = (submodules: Submodule[]): string => {
  const matrix: GAMatrix = {
    name: submodules.map((submodule) => submodule.name),
    include: submodules,
  };
  return toJson(matrix);
};

/**
 * The main function for the action.
 */
export async function run(): Promise<void> {
  try {
    const { gitmodulesPath, inputSubmodules, strategy } = await parseInputs();

    const gitmodulesContent = await readFile(gitmodulesPath);
    if (gitmodulesContent === "") {
      core.info("No submodules detected.");
      core.info("Nothing to do. Exiting...");
      return;
    }

    const detectedSubmodules = await parseGitmodules(gitmodulesContent);
    logInfoAndDebug("Detected Submodules", detectedSubmodules);

    const validSubmodules = await filterSubmodules(
      inputSubmodules,
      detectedSubmodules,
      strategy
    );
    if (validSubmodules.length === 0) {
      core.info("No valid submodules detected.");
      core.info("Nothing to do. Exiting...");
      return;
    }
    logInfoAndDebug("Valid submodules", validSubmodules);

    const updatedSubmodules = await updateToLatestCommit(validSubmodules);
    if (updatedSubmodules.length === 0) {
      core.info("All submodules have no new remote commits.");
      core.info("Nothing to do. Exiting...");
      return;
    }
    logInfoAndDebug("Updated submodules", updatedSubmodules);

    let outputSubmodules = updatedSubmodules;
    if (strategy === "tag") {
      outputSubmodules = await updateToLatestTag(updatedSubmodules);
    }

    core.setOutput("json", toJson(outputSubmodules));
    core.setOutput("matrix", toJsonMatrix(outputSubmodules));
    core.setOutput("prBody", multiplePrBody(outputSubmodules));
    for (const submodule of outputSubmodules) {
      setDynamicOutputs(submodule.name, submodule);
      if (submodule.name !== submodule.path) {
        setDynamicOutputs(submodule.path, submodule);
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
