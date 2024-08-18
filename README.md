<h1 align="center">
    update-git-submodules (
    <a href="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml"><img src="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml/badge.svg"></a> )
</h1>

This GitHub Action updates one or more git submodules in a repository. It **does
not** commit or push these changes back to the repository, please see the
"[Scenarios](#scenarios)" section for examples on how to do this.

> [!WARNING]
> This is still a **work in progress**. Please pin to a specific commit hash to
> avoid unexpected behaviour in your workflows.

## Usage

```yaml
- uses: sgoudham/update-git-submodules@<commit_hash>
  with:
    # The path to the '.gitmodules' file.
    # Defaults to '.gitmodules' in the root of the repository.
    gitmodulesPath: ""

    # The git submodule(s) to update, the path should be the same as the one specified in the '.gitmodules' file.
    # Defaults to all submodules in the '.gitmodules' file.
    submodules: |
      submodules/catppuccin
      submodules/sgoudham
```

## Outputs

**TODO**

## Scenarios

### Update one submodule and create a pull request

The assumption in the following workflow is that the `.gitmodules` file only
contains one submodule targeting
[catppuccin/vscode-icons](https://github.com/catppuccin/vscode-icons) at the path `./vscode-icons`.

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4
    with:
      submodules: "recursive"
      fetch-depth: 0

  - name: Update Submodules
    id: submodules
    uses: "sgoudham/update-git-submodules@<commit_hash>"

  - name: Create PR
    uses: peter-evans/create-pull-request@v6
    if: ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}
    with:
      commit-message: "feat: update catppuccin/vscode-icons to ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      branch: "feat/update-vscode-icons-${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      title: "feat: update catppuccin/vscode-icons submodule to ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      body: |
        This automated PR updates the catppuccin/vscode submodule to ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}.
```

## License

[MIT](./LICENSE)
