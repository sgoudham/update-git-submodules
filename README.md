<h1 align="center">
    update-git-submodules (
    <a href="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml"><img src="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml/badge.svg"></a> )
</h1>

This GitHub Action updates one or more git submodules in a repository to the
latest tag. The primary use case for this action is to be used across the
[Catppuccin](https://github.com/catppuccin) GitHub organisation, allowing
repositories to update submodules to known stable versions.

It **does not** commit or push these changes back to the repository, please see
the "[Scenarios](#scenarios)" section for examples on how to do this.

> [!WARNING]
> This is still a **work in progress**. Please pin to a specific commit hash to
> avoid unexpected behaviour in your workflows.

## Usage

```yaml
- uses: sgoudham/update-git-submodules@main
  with:
    # The path to the '.gitmodules' file.
    #
    # Defaults to '.gitmodules' in the root of the repository.
    gitmodulesPath: ""

    # The git submodule(s) to update, the path should be the
    # same as the one specified in the '.gitmodules' file.
    #
    # Defaults to all submodules in the '.gitmodules' file.
    submodules: ""
```

## Outputs

### Static Outputs

- `json`: A JSON array containing all the submodules that were updated.
- `matrix`: A JSON array containing all the submodules that were updated,
  intended for use in a GitHub Actions matrix strategy.
- `prBody`: A Markdown string containing a formatted table of all the submodules
  that were updated, intended for use in a pull request body.

### Dynamic Outputs

As well as the static outputs, this action will also output the following variables:

- `path`: The path to the submodule that was updated.
- `url`: The GitHub URL of the submodule that was updated.
- `previousTag`: The tag of the submodule before it was updated.
- `latestTag`: The tag that the submodule was updated to.
- `prBody`: A Markdown string intended for use in a pull request body.

These dynamic outputs will be prefixed with the submodule name (and the
submodule path if the name is different to the path) followed by two hyphens
(`--`).

For example, if the submodule is named `vscode-icons` and the path is
`ports/vscode-icons`, the dynamic outputs will be:

- `vscode-icons--path`
- `vscode-icons--url`
- `vscode-icons--previousTag`
- `vscode-icons--latestTag`
- `vscode-icons--prBody`
- `ports/vscode-icons--path`
- `ports/vscode-icons--url`
- `ports/vscode-icons--previousTag`
- `ports/vscode-icons--latestTag`
- `ports/vscode-icons--prBody`

## Scenarios

1. [Update one submodule and create one pull request](#update-one-submodule-and-create-one-pull-request)
2. [Update multiple submodules and create one pull request](#update-multiple-submodules-and-create-one-pull-request)
3. [Update multiple submodules and create multiple pull requests](#update-multiple-submodules-and-create-multiple-pull-requests)

### Update one submodule and create one pull request

`.gitmodules`

```ini
[submodule "vscode-icons"]
	path = ports/vscode-icons
	url = https://github.com/catppuccin/vscode-icons.git
```

`workflow.yml`

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4
    with:
      submodules: "recursive"
      fetch-depth: 0

  - name: Update Submodules
    id: submodules
    uses: "sgoudham/update-git-submodules@main"

  - name: Create PR
    uses: peter-evans/create-pull-request@v6
    if: ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}
    with:
      commit-message: "feat: update catppuccin/vscode-icons to ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      branch: "feat/update-vscode-icons-${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      title: "feat: update catppuccin/vscode-icons submodule to ${{ steps.submodules.outputs['vscode-icons--latestTag'] }}"
      body: ${{ steps.submodules.outputs.prBody }}
```

### Update multiple submodules and create one pull request

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4
    with:
      submodules: "recursive"
      fetch-depth: 0

  - name: Update Submodules
    id: submodules
    uses: "sgoudham/update-git-submodules@main"

  - name: Create PR
    uses: peter-evans/create-pull-request@v6
    with:
      commit-message: "feat: update all submodules"
      branch: "feat/update-all-submodules"
      title: "feat: update all submodules"
      body: ${{ steps.submodules.outputs.prBody }}
```

### Update multiple submodules and create multiple pull requests

`.gitmodules`

```ini
[submodule "ports/nvim"]
	path = ports/nvim
	url = https://github.com/catppuccin/nvim.git
[submodule "ports/mdBook"]
	path = ports/mdBook
	url = https://github.com/catppuccin/mdBook.git
[submodule "ports/vscode-icons"]
	path = ports/vscode-icons
	url = https://github.com/catppuccin/vscode-icons.git
```

`workflow.yml`

```yaml

```

## License

[MIT](./LICENSE)
