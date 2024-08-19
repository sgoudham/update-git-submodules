import * as core from "@actions/core";
import { exec, ExecOutput, getExecOutput } from "@actions/exec";
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

type SubmoduleWithTag = Submodule & {
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
    /^\[submodule\s+"([^"]+)"\]\s*\n\s*path\s*=\s*(.+)\s*\n\s*url\s*=\s*(.+)\s*$/gm;
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

const updateAllSubmodules = async (): Promise<ExecOutput> => {
  // Allow git to update the submodules with its internal logic
  return await getExecOutput("git submodule update --remote");
};

export const filterSubmodules = async (
  rawUpdatedSubmodules: string,
  detectedSubmodules: Submodule[],
  userSubmodules: string
): Promise<Submodule[]> => {
  // Parse the updated submodules from the git output
  // ASSUMPTION: The first set of single quotes is the submodule path
  const updatedSubmodules = rawUpdatedSubmodules
    .trim()
    .split("\n")
    .map((line) => line.split("'")[1]);
  core.debug(`Updated submodules: ${toJson(updatedSubmodules)}`);

  // If the user hasn't specified the submodules to update, return the intersection of the detected and updated submodules
  if (!userSubmodules) {
    return detectedSubmodules.filter((submodule) =>
      updatedSubmodules.some((updated) => updated === submodule.path)
    );
  }

  // Github Actions doesn't support array inputs, so the submodules are passed as a string with each submodule in a new line
  const parsedUserSubmodules = userSubmodules
    .trim()
    .split("\n")
    .map((submodule) => submodule.trim().replace(/"/g, ""));
  core.debug(`User submodules: ${toJson(parsedUserSubmodules)}`);

  // We only want to update user's submodule(s) if git has updated it
  return detectedSubmodules.filter(
    (submodule) =>
      parsedUserSubmodules.some((parsed) => parsed === submodule.path) &&
      updatedSubmodules.some((updated) => updated === submodule.path)
  );
};

const updateToLatestTag = async (
  updatedSubmodules: Submodule[]
): Promise<SubmoduleWithTag[]> => {
  const submodulesWithTag = updatedSubmodules.map(async (submodule) => {
    core.info(`Fetching latest tag: ${submodule.path}`);

    const latestTag = (
      await getExecOutput("git describe --abbrev=0 --tags", [], {
        cwd: submodule.path,
      })
    ).stdout.trim();

    await exec(`git reset --hard ${latestTag}`, [], { cwd: submodule.path });

    return { ...submodule, latestTag } as SubmoduleWithTag;
  });

  return await Promise.all(submodulesWithTag);
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
    core.info(`Detected submodules: ${toJson(detectedSubmodules)}`);

    const { stdout: rawUpdatedSubmodules } = await updateAllSubmodules();
    if (rawUpdatedSubmodules.trim() === "") {
      core.info("All submodules have no new remote commits.");
      core.info("Nothing to do. Exiting...");
      return;
    }

    const filteredSubmodules = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      inputSubmodules
    );
    core.info(
      `Submodules with new remote commits: ${toJson(filteredSubmodules)}`
    );

    const submodulesWithTag = await updateToLatestTag(filteredSubmodules);

    for (const { name, path, url, latestTag } of submodulesWithTag) {
      core.setOutput(`${name}--path`, path);
      core.setOutput(`${name}--url`, url);
      core.setOutput(`${name}--latestTag`, latestTag);
    }
    core.setOutput("updatedJson", toJson(submodulesWithTag, 0));
    core.setOutput(
      "updatedMatrix",
      toJson(
        {
          name: submodulesWithTag.map((submodule) => submodule.name),
          include: submodulesWithTag,
        } as GAMatrix,
        0
      )
    );
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}
