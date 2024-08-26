import { expect, test } from "vitest";
import { multiplePrBody, singlePrBody } from "../markdown";
import { mdBookSubmodule, nvimSubmodule, vscodeIconsSubmodule } from "./utils";

test("markdown pr body for multiple submodules", async () => {
  const [mdBook, nvim, vscodeIcons] = [
    mdBookSubmodule(),
    nvimSubmodule(),
    vscodeIconsSubmodule(),
  ];
  mdBook.latestShortCommitSha = "c9868d3";
  mdBook.latestCommitSha = "c9868d34c04df61207141ba4b7dc51d270fda7ec";
  nvim.latestShortCommitSha = "4fd72a9";
  nvim.latestCommitSha = "4fd72a9ab64b393c2c22b168508fd244877fec96";
  vscodeIcons.latestShortCommitSha = "da859f0";
  vscodeIcons.latestCommitSha = "da859f02ffb1ec834ce2efabb7f5bab8667e294c";
  const submodules = [mdBook, nvim, vscodeIcons];
  const expected = `
| --- | --- | --- |
| [ports/mdBook](https://github.com/catppuccin/mdBook.git) | ports/mdBook | [a19a19b...c9868d3](https://github.com/catppuccin/mdBook/compare/a19a19bd14f26c3bba311bbffc5a74710add5ac2...c9868d34c04df61207141ba4b7dc51d270fda7ec) |
| [ports/nvim](https://github.com/catppuccin/nvim.git) | ports/nvim | [774a4ed...4fd72a9](https://github.com/catppuccin/nvim/compare/774a4ed9a69d0a2633da60f73aa63a8e23aacced...4fd72a9ab64b393c2c22b168508fd244877fec96) |
| [ports/vscode-icons](https://github.com/catppuccin/vscode-icons.git) | ports/vscode-icons | [71d98b8...da859f0](https://github.com/catppuccin/vscode-icons/compare/71d98b81bfdb6b8d3527037c3017eb07e6ec0621...da859f02ffb1ec834ce2efabb7f5bab8667e294c) |
`;

  const actual = multiplePrBody(submodules);

  expect(actual).toContain(expected);
});

test("single pr body for single submodule", async () => {
  const vscodeIcons = vscodeIconsSubmodule();
  vscodeIcons.latestShortCommitSha = "da859f0";
  vscodeIcons.latestCommitSha = "da859f02ffb1ec834ce2efabb7f5bab8667e294c";
  const expected = `
| --- | --- | --- |
| [ports/vscode-icons](https://github.com/catppuccin/vscode-icons.git) | ports/vscode-icons | [71d98b8...da859f0](https://github.com/catppuccin/vscode-icons/compare/71d98b81bfdb6b8d3527037c3017eb07e6ec0621...da859f02ffb1ec834ce2efabb7f5bab8667e294c) |
`;

  const actual = singlePrBody(vscodeIcons);

  expect(actual).toContain(expected);
});

test("markdown pr body for multiple submodules using tag strategy", async () => {
  const [mdBook, nvim, vscodeIcons] = [
    mdBookSubmodule(),
    nvimSubmodule(),
    vscodeIconsSubmodule(),
  ];
  mdBook.latestTag = "v2.2.0";
  nvim.latestTag = "v1.9.0";
  vscodeIcons.latestTag = "v1.15.0";
  const submodules = [mdBook, nvim, vscodeIcons];
  const expected = `
| --- | --- | --- |
| [ports/mdBook](https://github.com/catppuccin/mdBook.git) | ports/mdBook | [v0.1.2...v2.2.0](https://github.com/catppuccin/mdBook/compare/v0.1.2...v2.2.0) |
| [ports/nvim](https://github.com/catppuccin/nvim.git) | ports/nvim | [v1.8.0...v1.9.0](https://github.com/catppuccin/nvim/compare/v1.8.0...v1.9.0) |
| [ports/vscode-icons](https://github.com/catppuccin/vscode-icons.git) | ports/vscode-icons | [v1.14.0...v1.15.0](https://github.com/catppuccin/vscode-icons/compare/v1.14.0...v1.15.0) |
`;

  const actual = multiplePrBody(submodules);

  expect(actual).toContain(expected);
});

test("single pr body for single submodule using tag strategy", async () => {
  const vscodeIcons = vscodeIconsSubmodule();
  vscodeIcons.latestTag = "v1.15.0";
  const expected = `
| --- | --- | --- |
| [ports/vscode-icons](https://github.com/catppuccin/vscode-icons.git) | ports/vscode-icons | [v1.14.0...v1.15.0](https://github.com/catppuccin/vscode-icons/compare/v1.14.0...v1.15.0) |
`;

  const actual = singlePrBody(vscodeIcons);

  expect(actual).toContain(expected);
});
