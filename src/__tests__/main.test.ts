import { expect, test, vi } from "vitest";
import {
  filterSubmodules,
  Inputs,
  parseGitmodules,
  parseInputs,
  readFile,
  setDynamicOutputs,
  Submodule,
  updateToLatestCommit,
  updateToLatestTag,
  getRemoteName,
} from "../main";
import { getExecOutput } from "@actions/exec";
import {
  mdBookSubmodule,
  nvimSubmodule,
  vscodeIconsSubmodule
} from "./utils";
import { getInput, setOutput } from "@actions/core";

vi.mock("@actions/core", async () => {
  return {
    getInput: vi.fn(),
    setOutput: vi.fn(),
    info: vi.fn((val) => console.info(val)),
    debug: vi.fn((val) => console.debug(val)),
  };
});

vi.mock("@actions/exec", async () => {
  return {
    exec: vi.fn(),
    getExecOutput: vi.fn(),
  };
});

test("parse GitHub Action inputs", async () => {
  const expected: Inputs = {
    gitmodulesPath: ".gitmodules",
    inputSubmodules: ["ports/mdBook", "ports/nvim"],
    strategy: "commit",
  };

  vi.mocked(getInput)
    .mockReturnValueOnce(".gitmodules")
    .mockReturnValueOnce(`\n"ports/mdBook"\n"ports/nvim"\n`)
    .mockReturnValueOnce("commit");

  const actual = await parseInputs();
  expect(actual).toEqual(expected);
});

test("parse GitHub Action inputs with no input submodules", async () => {
  const expected: Inputs = {
    gitmodulesPath: ".gitmodules",
    inputSubmodules: [],
    strategy: "tag",
  };

  vi.mocked(getInput)
    .mockReturnValueOnce(".gitmodules")
    .mockReturnValueOnce("")
    .mockReturnValueOnce("tag");

  const actual = await parseInputs();
  expect(actual).toEqual(expected);
});

test.each([
  ["ssh://user@host.xz:port/path/to/repo.git/", "port/path/to/repo"],
  ["ssh://user@host.xz/path/to/repo.git/", "path/to/repo"],
  ["ssh://host.xz:port/path/to/repo.git/", "port/path/to/repo"],
  ["ssh://host.xz/path/to/repo.git/", "path/to/repo"],
  ["ssh://user@host.xz/path/to/repo.git/", "path/to/repo"],
  ["ssh://host.xz/path/to/repo.git/", "path/to/repo"],
  ["ssh://user@host.xz/~user/path/to/repo.git/", "user/path/to/repo"],
  ["ssh://host.xz/~user/path/to/repo.git/", "user/path/to/repo"],
  ["ssh://user@host.xz/~/path/to/repo.git", "path/to/repo"],
  ["ssh://host.xz/~/path/to/repo.git", "path/to/repo"],
  ["user@host.xz:/path/to/repo.git/", "path/to/repo"],
  ["host.xz:/path/to/repo.git/", "path/to/repo"],
  ["user@host.xz:~user/path/to/repo.git/", "user/path/to/repo"],
  ["host.xz:~user/path/to/repo.git/", "user/path/to/repo"],
  ["user@host.xz:path/to/repo.git", "path/to/repo"],
  ["host.xz:path/to/repo.git", "path/to/repo"],
  ["rsync://host.xz/path/to/repo.git/", "path/to/repo"],
  ["git://host.xz/path/to/repo.git/", "path/to/repo"],
  ["git://host.xz/~user/path/to/repo.git/", "user/path/to/repo"],
  ["http://host.xz/path/to/repo.git/", "path/to/repo"],
  ["https://host.xz/path/to/repo.git/", "path/to/repo"],
  ["/path/to/repo.git/", "path/to/repo"],
  ["path/to/repo.git/", "path/to/repo"],
  ["~/path/to/repo.git", "path/to/repo"],
  ["file:///path/to/repo.git/", "path/to/repo"],
  ["file://~/path/to/repo.git/", "path/to/repo"],
])('getRemoteName(%s) -> %s', (url, expected) => {
  expect(getRemoteName(url)).toBe(expected)
})

test("extract single submodule from .gitmodules", async () => {
  const input = await readFile("src/__tests__/fixtures/single-gitmodules.ini");
  const expected = [mdBookSubmodule()];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousTag}`,
        stderr: "",
      })
    );

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("extract single submodule from .gitmodules with ssh-style url", async () => {
  const input = await readFile("src/__tests__/fixtures/ssh-gitmodules.ini");
  const submodule = mdBookSubmodule()
  submodule.url = "git@github.com:catppuccin/mdBook.git"
  const expected = [submodule];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousTag}`,
        stderr: "",
      })
    );

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("extract single submodule from .gitmodules that has no tags", async () => {
  const input = await readFile("src/__tests__/fixtures/single-gitmodules.ini");
  const expected = [mdBookSubmodule()];
  expected[0].previousTag = undefined;
  expected[0].previousCommitShaHasTag = false;

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expected[0].previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n\n`,
        stderr: "",
      })
    )
    .mockRejectedValueOnce(new Error());

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("extract multiple git submodules from .gitmodules", async () => {
  const input = await readFile(
    "src/__tests__/fixtures/multiple-gitmodules.ini"
  );
  const [nvim, mdBook, vscodeIcons] = [
    nvimSubmodule(),
    mdBookSubmodule(),
    vscodeIconsSubmodule(),
  ];
  const expected: Submodule[] = [nvim, mdBook, vscodeIcons];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${nvim.previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${mdBook.previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${vscodeIcons.previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${nvim.previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${mdBook.previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${vscodeIcons.previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${nvim.previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${mdBook.previousTag}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${vscodeIcons.previousTag}`,
        stderr: "",
      })
    );

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("filter submodules when no user submodules", async () => {
  const detectedSubmodules: Submodule[] = [mdBookSubmodule()];
  const userSubmodules: string[] = [];
  const actual = await filterSubmodules(
    userSubmodules,
    detectedSubmodules,
    "commit"
  );
  expect(actual).toEqual(detectedSubmodules);
});

test("filter submodules where user specifies some submodules", async () => {
  const userSubmodules = ["ports/mdBook"];
  const detectedSubmodules: Submodule[] = [mdBookSubmodule(), nvimSubmodule()];
  const expected = [mdBookSubmodule()];

  const actual = await filterSubmodules(
    userSubmodules,
    detectedSubmodules,
    "commit"
  );

  expect(actual).toEqual(expected);
});

test("filter submodules where user submodules matches detected submodules", async () => {
  const userSubmodules = ["ports/mdBook", "ports/vscode-icons"];
  const detectedSubmodules: Submodule[] = [
    mdBookSubmodule(),
    vscodeIconsSubmodule(),
  ];
  const expected = [mdBookSubmodule(), vscodeIconsSubmodule()];

  const actual = await filterSubmodules(
    userSubmodules,
    detectedSubmodules,
    "commit"
  );

  expect(actual).toEqual(expected);
});

test("filter submodules when tag strategy and submodules do not have tags", async () => {
  const [nvim, mdBook, vscodeIcons] = [
    nvimSubmodule(),
    mdBookSubmodule(),
    vscodeIconsSubmodule(),
  ];
  mdBook.previousTag = undefined;
  vscodeIcons.previousTag = undefined;
  const detectedSubmodules: Submodule[] = [nvim, mdBook, vscodeIcons];
  const userSubmodules: string[] = [];
  const expected = [nvim];

  const actual = await filterSubmodules(
    userSubmodules,
    detectedSubmodules,
    "tag"
  );

  expect(actual).toEqual(expected);
});

test("update submodules when there are no new commits", async () => {
  const filteredSubmodules: Submodule[] = [mdBookSubmodule()];
  vi.mocked(getExecOutput).mockReturnValue(
    Promise.resolve({
      exitCode: 0,
      stdout: "\n",
      stderr: "",
    })
  );
  const actual = await updateToLatestCommit(filteredSubmodules);
  expect(actual).toEqual([]);
});

test("update submodules to latest commit when there are new commits", async () => {
  const filteredSubmodules: Submodule[] = [nvimSubmodule(), mdBookSubmodule()];
  const mdBook = mdBookSubmodule();
  mdBook.latestShortCommitSha = "goudham";
  mdBook.latestCommitSha = "goudham";
  const expected = [mdBook];

  vi.mocked(getExecOutput).mockReturnValue(
    Promise.resolve({
      exitCode: 0,
      stdout: `
      Submodule path '${mdBook.path}': checked out '${mdBook.latestCommitSha}'
      `,
      stderr: "",
    })
  );

  const actual = await updateToLatestCommit(filteredSubmodules);
  expect(actual).toEqual(expected);
  expect(actual[0].previousCommitSha).not.toEqual(expected[0].latestCommitSha);
  expect(actual[0].previousShortCommitSha).not.toEqual(
    expected[0].latestShortCommitSha
  );
});

test("update submodules to latest tag", async () => {
  const [inputNvim, inputMdbook] = [nvimSubmodule(), mdBookSubmodule()];
  const updatedSubmodules = [inputNvim, inputMdbook];
  const [expectedNvim, expectedMdbook] = [nvimSubmodule(), mdBookSubmodule()];
  expectedNvim.latestTag = "v1.0.0";
  expectedMdbook.latestTag = "v2.0.0";
  const expected = [expectedNvim, expectedMdbook];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expectedNvim.latestTag}\n`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${expectedMdbook.latestTag}\n`,
        stderr: "",
      })
    );

  const actual = await updateToLatestTag(updatedSubmodules);

  expect(actual).toEqual(expected);
});

test("set GitHub Action dynamic outputs", async () => {
  const prefix = "mdBook";
  const submodule = mdBookSubmodule();

  setDynamicOutputs(prefix, submodule);

  expect(setOutput).toHaveBeenCalledTimes(11);
});
