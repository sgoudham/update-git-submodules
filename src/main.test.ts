import { expect, test, vi } from "vitest";
import {
  filterSubmodules,
  parseGitModules,
  Submodule,
  SubmoduleWithLatestTag,
  updateSubmodules,
  updateToLatestTag,
} from "./main";
import { getExecOutput } from "@actions/exec";

vi.mock("@actions/exec", async () => {
  return {
    exec: vi.fn(),
    getExecOutput: vi.fn(),
  };
});

test("extract single git submodule from .gitmodules", async () => {
  const input = `
  [submodule "the-best-port-ever"]
  	path = ports/mdBook
  	url = https://github.com/catppuccin/mdBook.git
  `;
  const expected: Submodule[] = [
    {
      name: "the-best-port-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "",
    },
  ];

  vi.mocked(getExecOutput).mockReturnValueOnce(
    Promise.resolve({
      exitCode: 0,
      stdout: "\n",
      stderr: "",
    })
  );

  const actual = await parseGitModules(input);
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
  [submodule "the-best"]
  	path = ports/vscode-icons
  	url = https://github.com/catppuccin/vscode-icons.git
  `;
  const expected: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "ports/mdBook",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
    {
      name: "the-best",
      path: "ports/vscode-icons",
      url: "https://github.com/catppuccin/vscode-icons.git",
      previousTag: "v1.0.0",
    },
  ];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: "\nv0.1.0\n",
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: "\nv2.2.9\n",
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: "\nv1.0.0\n",
        stderr: "",
      })
    );

  const actual = await parseGitModules(input);
  expect(actual).toEqual(expected);
});

test("filter submodules where user hasn't specified any submodules", async () => {
  const detectedSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "ports/mdBook",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ];
  const userSubmodules = ``;
  const actual = await filterSubmodules(userSubmodules, detectedSubmodules);
  expect(actual).toEqual(detectedSubmodules);
});

test("filter submodules where user specifies some submodules", async () => {
  const userSubmodules = `\n"ports/mdBook"\n"ports/vscode"\n`;
  const detectedSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ];
  const actual = await filterSubmodules(userSubmodules, detectedSubmodules);
  expect(actual).toEqual([
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ]);
});

test("filter submodules where user submodules matches detected submodules", async () => {
  const userSubmodules = `\n"ports/mdBook"\n"ports/nvim"\n`;
  const detectedSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ];
  const actual = await filterSubmodules(userSubmodules, detectedSubmodules);
  expect(actual).toEqual(detectedSubmodules);
});

test("filter submodules where there is an empty previousTag", async () => {
  const userSubmodules = `\n"ports/mdBook"\n"ports/nvim"\n`;
  const detectedSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
    {
      name: "ports/aur-packages",
      path: "ports/aur-packages",
      url: "https://github.com/catppuccin/aur-packages.git",
      previousTag: "",
    },
  ];
  const actual = await filterSubmodules(userSubmodules, detectedSubmodules);
  expect(actual).toEqual([
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ]);
});

test("update submodules when there are no new commits", async () => {
  const filteredSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
  ];
  vi.mocked(getExecOutput).mockReturnValue(
    Promise.resolve({
      exitCode: 0,
      stdout: "\n",
      stderr: "",
    })
  );
  const actual = await updateSubmodules(filteredSubmodules);
  expect(actual).toEqual([]);
});

test("update submodules when there are new commits", async () => {
  const filteredSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ];
  vi.mocked(getExecOutput).mockReturnValue(
    Promise.resolve({
      exitCode: 0,
      stdout: `
      Submodule path 'ports/mdBook': checked out 'c9868d34c04df61207141ba4b7dc51d270fda7ec'
      `,
      stderr: "",
    })
  );
  const actual = await updateSubmodules(filteredSubmodules);
  expect(actual).toEqual([
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ]);
});

test("update to latest tag", async () => {
  const updatedSubmodules: Submodule[] = [
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
    },
  ];

  vi.mocked(getExecOutput)
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: "\nv2.0.0\n",
        stderr: "",
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        exitCode: 0,
        stdout: "\nv4.0.0\n",
        stderr: "",
      })
    );

  const actual = await updateToLatestTag(updatedSubmodules);

  expect(actual).toEqual([
    {
      name: "ports/nvim",
      path: "ports/nvim",
      url: "https://github.com/catppuccin/nvim.git",
      previousTag: "v0.1.0",
      latestTag: "v2.0.0",
    },
    {
      name: "simply-the-best-repository-ever",
      path: "ports/mdBook",
      url: "https://github.com/catppuccin/mdBook.git",
      previousTag: "v2.2.9",
      latestTag: "v4.0.0",
    },
  ] as SubmoduleWithLatestTag[]);
});
