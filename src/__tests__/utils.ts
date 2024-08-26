import { Submodule } from "../main";

class SubmoduleBuilder {
  private submodule: Partial<Submodule> = {};

  constructor(init?: Partial<Submodule>) {
    if (init) {
      this.submodule = { ...init };
    }
  }

  setName(name: string): SubmoduleBuilder {
    this.submodule.name = name;
    return this;
  }

  setPath(path: string): SubmoduleBuilder {
    this.submodule.path = path;
    return this;
  }

  setUrl(url: string): SubmoduleBuilder {
    this.submodule.url = url;
    return this;
  }

  setPreviousShortCommitSha(sha: string): SubmoduleBuilder {
    this.submodule.previousShortCommitSha = sha;
    return this;
  }

  setPreviousCommitSha(sha: string): SubmoduleBuilder {
    this.submodule.previousCommitSha = sha;
    return this;
  }

  setPreviousTag(tag: string): SubmoduleBuilder {
    this.submodule.previousTag = tag;
    return this;
  }

  setLatestShortCommitSha(sha: string): SubmoduleBuilder {
    this.submodule.latestShortCommitSha = sha;
    return this;
  }

  setLatestCommitSha(sha: string): SubmoduleBuilder {
    this.submodule.latestCommitSha = sha;
    return this;
  }

  setLatestTag(tag: string): SubmoduleBuilder {
    this.submodule.latestTag = tag;
    return this;
  }

  build(): Submodule {
    if (
      !this.submodule.name ||
      !this.submodule.path ||
      !this.submodule.url ||
      !this.submodule.previousShortCommitSha ||
      !this.submodule.previousCommitSha ||
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
  previousShortCommitSha: string = "a19a19b",
  previousCommitSha: string = "a19a19bd14f26c3bba311bbffc5a74710add5ac2",
  previousTag: string = "v0.1.2",
  latestShortCommitSha: string = "a19a19b",
  latestCommitSha: string = "a19a19bd14f26c3bba311bbffc5a74710add5ac2"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    previousShortCommitSha,
    previousCommitSha,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};

export const vscodeIconsSubmodule = (
  name: string = "ports/vscode-icons",
  path: string = "ports/vscode-icons",
  url: string = "https://github.com/catppuccin/vscode-icons.git",
  previousShortCommitSha: string = "71d98b8",
  previousCommitSha: string = "71d98b81bfdb6b8d3527037c3017eb07e6ec0621",
  previousTag: string = "v1.14.0",
  latestShortCommitSha: string = "71d98b8",
  latestCommitSha: string = "71d98b81bfdb6b8d3527037c3017eb07e6ec0621"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    previousShortCommitSha,
    previousCommitSha,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};

export const nvimSubmodule = (
  name: string = "ports/nvim",
  path: string = "ports/nvim",
  url: string = "https://github.com/catppuccin/nvim.git",
  previousShortCommitSha: string = "774a4ed",
  previousCommitSha: string = "774a4ed9a69d0a2633da60f73aa63a8e23aacced",
  previousTag: string = "v1.8.0",
  latestShortCommitSha: string = "774a4ed",
  latestCommitSha: string = "774a4ed9a69d0a2633da60f73aa63a8e23aacced"
) => {
  return new SubmoduleBuilder({
    name,
    path,
    url,
    previousShortCommitSha,
    previousCommitSha,
    previousTag,
    latestShortCommitSha,
    latestCommitSha,
  }).build();
};
