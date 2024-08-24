import { exec, getExecOutput } from "@actions/exec";
import * as core from "@actions/core";
import * as fs from "node:fs/promises";

type GAMatrix = {
  name: string[];
  include: Submodule[];
};

export type Submodule = {
  name: string;
  path: string;
  url: string;
};

export type SubmoduleWithLatestTag = Submodule & {
  latestTag: string;
};

type ReadFileOutput = {
  exitCode: number;
  err: string;
  contents: string;
};

const toJson = (value: any, padding: number = 2): string =>
  JSON.stringify(value, null, padding);

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

export const parseGitModules = (content: string): Submodule[] => {
  const gitmodulesRegex =
    /^\s*\[submodule\s+"([^"]+)"\]\s*\n\s*path\s*=\s*(.+)\s*\n\s*url\s*=\s*(.+)\s*$/gm;
  return Array.from(content.matchAll(gitmodulesRegex)).map(
    ([_, name, path, url]) => {
      return {
        name: name,
        path: path,
        url: url,
      };
    }
  );
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
    core.info(`Fetching latest tag: ${submodule.path}`);
    const options = { cwd: submodule.path };

    const latestTag = (
      await getExecOutput("git describe --abbrev=0 --tags", [], options)
    ).stdout.trim();

    await exec(`git reset --hard`, [latestTag], options);

    return { ...submodule, latestTag } as SubmoduleWithLatestTag;
  });

  return await Promise.all(submodulesWithTag);
};

export const generateMarkdownTable = (submodules: SubmoduleWithLatestTag[]) => {
  const header =
    "| **Name** | **Path** | **Latest Tag** |\n| --- | --- | --- |";
  const body = submodules
    .map(
      (submodule) =>
        `| ${submodule.name} | ${submodule.path} | ${submodule.latestTag} |`
    )
    .join("\n");
  return `${header}\n${body}`;
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
    core.info(
      `Detected submodules: [${detectedSubmodules
        .map((submodule) => submodule.path)
        .join(", ")}]`
    );
    core.debug(`Detected submodules: ${toJson(detectedSubmodules)}`);

    const filteredSubmodules = await filterSubmodules(
      inputSubmodules,
      detectedSubmodules
    );
    core.info(
      `Submodules to update: [${filteredSubmodules
        .map((submodule) => submodule.path)
        .join(", ")}]`
    );
    core.debug(`Submodules to update: ${toJson(filteredSubmodules)}`);

    const updatedSubmodules = await updateSubmodules(filteredSubmodules);
    if (updatedSubmodules.length === 0) {
      core.info("All submodules have no new remote commits.");
      core.info("Nothing to do. Exiting...");
      return;
    }
    core.info(
      `Updated submodules: [${updatedSubmodules
        .map((submodule) => submodule.path)
        .join(", ")}]`
    );
    core.debug(`Updated submodules: ${toJson(updatedSubmodules)}`);

    const submodulesWithTag = await updateToLatestTag(updatedSubmodules);

    for (const { name, path, url, latestTag } of submodulesWithTag) {
      core.setOutput(`${name}--path`, path);
      core.setOutput(`${name}--url`, url);
      core.setOutput(`${name}--latestTag`, latestTag);
      if (name !== path) {
        core.setOutput(`${path}--path`, path);
        core.setOutput(`${path}--url`, url);
        core.setOutput(`${path}--latestTag`, latestTag);
      }
    }
    core.setOutput("json", toJson(submodulesWithTag, 0));
    core.setOutput(
      "matrix",
      toJson(
        {
          name: submodulesWithTag.map((submodule) => submodule.name),
          include: submodulesWithTag,
        } as GAMatrix,
        0
      )
    );
    core.setOutput(
      "markdownTable",
      generateMarkdownTable(submodulesWithTag)
    );
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
