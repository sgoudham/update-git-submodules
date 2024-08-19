import assert from "node:assert";
import { describe, it } from "node:test";
import { filterSubmodules, parseGitModules, Submodule } from "./main";

describe("parse .gitmodules", () => {
  it("extract single git submodule", () => {
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
      },
    ];

    const actual = parseGitModules(input);

    assert.deepEqual(actual, expected);
  });

  it("extract multiple git submodules", () => {
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
      },
      {
        name: "ports/mdBook",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
      {
        name: "the-best",
        path: "ports/vscode-icons",
        url: "https://github.com/catppuccin/vscode-icons.git",
      },
    ];

    const actual = parseGitModules(input);

    assert.deepEqual(actual, expected);
  });
});

describe("filter submodules", () => {
  it("filter submodules where user hasn't specified any submodules", async () => {
    const rawUpdatedSubmodules = `
Submodule path 'ports/mdBook': checked out 'c9868d34c04df61207141ba4b7dc51d270fda7ec'
Submodule path 'ports/nvim': checked out '18bab5ec4c782cdf7d7525dbe89c60bfa02fc195'
`;
    const detectedSubmodules: Submodule[] = [
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
      {
        name: "ports/mdBook",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
    ];
    const userSubmodules = "";

    const actual = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      userSubmodules
    );

    assert.deepEqual(actual, detectedSubmodules);
  });

  it("filter submodules where they have different names", async () => {
    const rawUpdatedSubmodules = `
Submodule path 'ports/mdBook': checked out 'c9868d34c04df61207141ba4b7dc51d270fda7ec'
Submodule path 'ports/nvim': checked out '18bab5ec4c782cdf7d7525dbe89c60bfa02fc195'
`;
    const detectedSubmodules: Submodule[] = [
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
      {
        name: "simply-the-best-repository-ever",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
    ];
    const userSubmodules = "";

    const actual = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      userSubmodules
    );

    assert.deepEqual(actual, detectedSubmodules);
  });

  it("filter submodules where not all detected submodules are updated", async () => {
    const rawUpdatedSubmodules = `
Submodule path 'ports/nvim': checked out '18bab5ec4c782cdf7d7525dbe89c60bfa02fc195'
`;
    const detectedSubmodules: Submodule[] = [
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
      {
        name: "ports/mdBook",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
    ];
    const userSubmodules = "";

    const actual = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      userSubmodules
    );

    assert.deepEqual(actual, [
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
    ]);
  });

  it("filter submodules where user submodule are passed in and update is available", async () => {
    const rawUpdatedSubmodules = `
Submodule path 'ports/vscode': checked out '18bab5ec4c782cdf7d7525dbe89c60bfa02fc195'
Submodule path 'ports/nvim': checked out '18bab5ec4c782cdf7d7525dbe89c60bfa02fc195'
Submodule path 'ports/mdBook': checked out 'c9868d34c04df61207141ba4b7dc51d270fda7ec'
`;
    const detectedSubmodules: Submodule[] = [
      {
        name: "ports/vscode",
        path: "ports/vscode",
        url: "https://github.com/catppuccin/vscode.git",
      },
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
      {
        name: "ports/mdBook",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
    ];
    const userSubmodules = `\n"ports/nvim"\n"ports/vscode"\n`;

    const actual = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      userSubmodules
    );

    assert.deepEqual(actual, [
      {
        name: "ports/vscode",
        path: "ports/vscode",
        url: "https://github.com/catppuccin/vscode.git",
      },
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
    ]);
  });

  it("filter submodules where user submodules are passed in and no updates are available", async () => {
    const rawUpdatedSubmodules = "";
    const detectedSubmodules: Submodule[] = [
      {
        name: "ports/nvim",
        path: "ports/nvim",
        url: "https://github.com/catppuccin/nvim.git",
      },
      {
        name: "ports/mdBook",
        path: "ports/mdBook",
        url: "https://github.com/catppuccin/mdBook.git",
      },
    ];
    const userSubmodules = `\n"ports/nvim"\n`;

    const actual = await filterSubmodules(
      rawUpdatedSubmodules,
      detectedSubmodules,
      userSubmodules
    );

    assert.equal(actual.length, 0);
  });
});
