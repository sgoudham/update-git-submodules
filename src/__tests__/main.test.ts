import { expect, test, vi } from "vitest";
import {
  filterSubmodules,
  Inputs,
  parseGitmodules,
  parseInputs,
  setDynamicOutputs,
  Submodule,
  updateToLatestCommit,
  updateToLatestTag,
} from "../main";
import { getExecOutput } from "@actions/exec";
import { mdBookSubmodule, nvimSubmodule, vscodeIconsSubmodule } from "./utils";
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

test("extract single submodule from .gitmodules", async () => {
  const input = `
  [submodule "ports/mdBook"]
  	path = ports/mdBook
  	url = https://github.com/catppuccin/mdBook.git
  `;
  const submodule = mdBookSubmodule();
  const expected = [submodule];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${submodule.previousCommitSha}`,
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${submodule.previousTag}`,
        stderr: "",
      })
    );

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("extract single submodule from .gitmodules that has no tags", async () => {
  const input = `
  [submodule "ports/mdBook"]
  	path = ports/mdBook
  	url = https://github.com/catppuccin/mdBook.git
  `;
  const submodule = mdBookSubmodule();
  submodule.previousTag = undefined;
  const expected = [submodule];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: `\n${submodule.previousCommitSha}`,
        stderr: "",
      })
    )
    .mockRejectedValueOnce(new Error());

  const actual = await parseGitmodules(input);
  expect(actual).toEqual(expected);
});

test("extract multiple git submodules from .gitmodules", async () => {
  const input = `
  [submodule "ports/nvim"]
  	path = ports/nvim
  	url = https://github.com/catppuccin/nvim.git
  [submodule "ports/mdBook"]
  	path = ports/mdBook
  	url = https://github.com/catppuccin/mdBook.git
  [submodule "ports/vscode-icons"]
  	path = ports/vscode-icons
  	url = https://github.com/catppuccin/vscode-icons.git
  `;
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

  expect(setOutput).toHaveBeenCalledTimes(9);
});
