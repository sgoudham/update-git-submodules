import * as core from "@actions/core";
import { exec, ExecOptions, ExecOutput, getExecOutput } from "@actions/exec";
import * as fs from "node:fs/promises";

type GAMatrix = {
  name: string[];
  include: Submodule[];
};

type Submodule = {
  name: string;
  path: string;
  url: string;
};

type SubmoduleWithTag = Submodule & {
  latestTag: string;
};

const toJson = (value: any, padding: number = 2): string =>
  JSON.stringify(value, null, padding);

const readFile = async (path: string): Promise<string | null> => {
  try {
    return await fs.readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        core.warning(`File not found: ${path}`);
        return null;
      }
      core.setFailed(`Error reading file: ${error.message}`);
    } else {
      core.setFailed("An unknown error occurred while reading the file");
    }
    return null;
  }
};

const parseGitModules = (content: string): Submodule[] => {
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

const updateSubmoduleRemotes = async (
  detectedSubmodules: Submodule[],
  userSubmodules: string
): Promise<Submodule[]> => {
  // Allow git to update the submodules
  const { stdout } = await getExecOutput("git submodule update --remote");

  // All submodules have no new remote commits, the action doesn't need to do anything after this
  if (stdout.trim() === "") {
    return [];
  }

  // Parse the updated submodules from the git output
  // ASSUMPTION: The first set of single quotes is the submodule path
  const updatedSubmodules = stdout
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

const updateToLatestTag = async (updatedSubmodules: Submodule[]) => {
  const submodulesWithTag: SubmoduleWithTag[] = [];

  for (const submodule of updatedSubmodules) {
    core.info(`Fetching latest tag: ${submodule.path}`);

    const latestTag = (
      await getExecOutput("git describe --abbrev=0 --tags", [], {
        cwd: submodule.path,
      })
    ).stdout.trim();

    await exec(`git reset --hard ${latestTag}`, [], { cwd: submodule.path });

    submodulesWithTag.push({ ...submodule, latestTag });
  }

  return submodulesWithTag;
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const gitModulesPath = core.getInput("gitmodulesPath");
    const inputSubmodules = core.getInput("submodules");

    const gitModulesContent = await readFile(gitModulesPath);
    if (gitModulesContent === null) {
      return;
    }

    const detectedSubmodules = await parseGitModules(gitModulesContent);
    core.info(`Detected submodules: ${toJson(detectedSubmodules)}`);

    const updatedSubmodules = await updateSubmoduleRemotes(
      detectedSubmodules,
      inputSubmodules
    );
    if (updatedSubmodules.length === 0) {
      core.info("Nothing to do.");
      core.info("Exiting...");
      return;
    }
    core.info(
      `Submodules with new remote commits: ${toJson(updatedSubmodules)}`
    );

    const submodulesWithTag = await updateToLatestTag(updatedSubmodules);

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
