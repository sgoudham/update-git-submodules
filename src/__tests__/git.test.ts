import { expect, test, vi } from "vitest";
import { getExecOutput } from "@actions/exec";
import { getCommit, getPreviousTag, getTag, hasTag } from "../git";

vi.mock("@actions/exec", async () => {
  return {
    exec: vi.fn(),
    getExecOutput: vi.fn(),
  };
});

test("get short and long commit sha", async () => {
  const input = "ports/nvim";

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "1234567890\n",
      stderr: "",
    })
  );

  const [commitSha, shortCommitSha] = await getCommit(input);

  expect(commitSha).toEqual("1234567890");
  expect(shortCommitSha).toEqual("1234567");
});

test("get tag", async () => {
  const input = "ports/nvim";

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "v1.0.0\n",
      stderr: "",
    })
  );

  const tag = await getTag(input);

  expect(tag).toEqual("v1.0.0");
});

test("successfully get previous tag", async () => {
  const input = "ports/nvim";

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "v1.0.0\n",
      stderr: "",
    })
  );

  const previousTag = await getPreviousTag(input);

  expect(previousTag).toEqual("v1.0.0");
});

test("fail to get previous tag and continue", async () => {
  const input = "ports/nvim";
  vi.mocked(getExecOutput).mockRejectedValue(new Error());
  const previousTag = await getPreviousTag(input);
  expect(previousTag).toEqual(undefined);
});

test("previous commit has a tag pointing to it", async () => {
  const input = "a19a19bd14f26c3bba311bbffc5a74710add5ac2";

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "v1.0.0\n",
      stderr: "",
    })
  );

  const previousCommitHasTag = await hasTag("", input);
  expect(previousCommitHasTag).true;
});

test("previous commit has no tag and continue", async () => {
  const input = "a19a19bd14f26c3bba311bbffc5a74710add5ac2";

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "\n\n",
      stderr: "",
    })
  );

  const previousCommitHasTag = await hasTag("", input);
  expect(previousCommitHasTag).false;
});
