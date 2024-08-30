import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";

export const getCommit = async (path: string): Promise<[string, string]> => {
  core.info(`Fetching commit for: ${path}`);
  const options = { cwd: path };
  const commitSha = (
    await getExecOutput("git rev-parse HEAD", [], options)
  ).stdout.trim();
  const shortCommitSha = commitSha.substring(0, 7);
  return [commitSha, shortCommitSha];
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
  return await getTag(path).catch((_) => {
    core.info(`'${path}': Submodule has no tags. Continuing...`);
    return undefined;
  });
};

export const hasTag = async (
  path: string,
  commitSha: string
): Promise<boolean> => {
  core.info(`'${path}': Checking if tag exists at commit '${commitSha}'`);
  const options = { cwd: path };
  const tag = (
    await getExecOutput("git tag --points-at HEAD", [], options)
  ).stdout.trim();
  return tag !== "";
};
