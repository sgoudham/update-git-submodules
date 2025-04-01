import { Submodule } from "../main";

class SubmoduleBuilder {
  private submodule: Partial<Submodule> = {};

  constructor(init?: Partial<Submodule>) {
    if (init) {
      this.submodule = { ...init };
    }
  }

  build(): Submodule {
    if (
      !this.submodule.name ||
      !this.submodule.path ||
      !this.submodule.url ||
      !this.submodule.remoteName ||
      !this.submodule.previousShortCommitSha ||
      !this.submodule.previousCommitSha ||
      !this.submodule.previousCommitShaHasTag ||
      !this.submodule.latestShortCommitSha ||
      !this.submodule.latestCommitSha
    ) {
      throw new Error("Missing required fields");
    }
    return this.submodule as Submodule;
  }
}

export const mdBookSubmodule = (
  name: string = "ports/mdBook",
  path: string = "ports/mdBook",
  url: string = "https://github.com/catppuccin/mdBook.git",
  remoteName: string = "catppuccin/mdBook",
  previousShortCommitSha: string = "a19a19b",
  previousCommitSha: string = "a19a19bd14f26c3bba311bbffc5a74710add5ac2",
  previousCommitShaHasTag: boolean = true,
  previousTag: string = "v0.1.2",
  latestShortCommitSha: string = "a19a19b",
  latestCommitSha: string = "a19a19bd14f26c3bba311bbffc5a74710add5ac2"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    remoteName,
    previousShortCommitSha,
    previousCommitSha,
    previousCommitShaHasTag,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};

export const vscodeIconsSubmodule = (
  name: string = "ports/vscode-icons",
  path: string = "ports/vscode-icons",
  url: string = "https://github.com/catppuccin/vscode-icons.git",
  remoteName: string = "catppuccin/vscode-icons",
  previousShortCommitSha: string = "71d98b8",
  previousCommitSha: string = "71d98b81bfdb6b8d3527037c3017eb07e6ec0621",
  previousCommitShaHasTag: boolean = true,
  previousTag: string = "v1.14.0",
  latestShortCommitSha: string = "71d98b8",
  latestCommitSha: string = "71d98b81bfdb6b8d3527037c3017eb07e6ec0621"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    remoteName,
    previousShortCommitSha,
    previousCommitSha,
    previousCommitShaHasTag,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};

export const nvimSubmodule = (
  name: string = "ports/nvim",
  path: string = "ports/nvim",
  url: string = "https://github.com/catppuccin/nvim.git",
  remoteName: string = "catppuccin/nvim",
  previousShortCommitSha: string = "774a4ed",
  previousCommitSha: string = "774a4ed9a69d0a2633da60f73aa63a8e23aacced",
  previousCommitShaHasTag: boolean = true,
  previousTag: string = "v1.8.0",
  latestShortCommitSha: string = "774a4ed",
  latestCommitSha: string = "774a4ed9a69d0a2633da60f73aa63a8e23aacced"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    remoteName,
    previousShortCommitSha,
    previousCommitSha,
    previousCommitShaHasTag,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};
