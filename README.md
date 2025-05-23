<h1 align="center">
    update-git-submodules 
    <br>
    ( <a href="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml"><img src="https://github.com/sgoudham/update-git-submodules/actions/workflows/build.yml/badge.svg"></a> )
</h1>

This GitHub Action updates one or more git submodules in a repository to the
latest commit or tag. The primary motivation behind creating this action was for
it be used across [Catppuccin](https://github.com/catppuccin), allowing
repositories to update their submodules to the latest git tag instead of the
latest commit.

> [!NOTE]  
> This action assumes that all git submodules are located in a separate GitHub
> repository, please raise an
> [issue](https://github.com/sgoudham/update-git-submodules/issues/new) if you'd
> like to see other platforms supported.

### What it does

- It automatically parses the `.gitmodules` file to find submodules.
- It updates one or more submodules to the latest commit or git tag.
- It allows the user to filter which submodules to update.

### What it doesn't do

- It **does not** commit or push these changes back to the repository. Please
  see the "[Creating Pull Requests](#creating-pull-requests)" section for examples on how to do this.

## Usage

<!-- x-release-please-start-version -->

```yaml
- uses: sgoudham/update-git-submodules@v2.1.3
  with:
    # The path to the '.gitmodules' file.
    #
    # Defaults to '.gitmodules' in the root of the repository.
    gitmodulesPath: ""

    # The strategy to use when updating the submodules. Can be either 'commit' or 'tag'.
    #
    # Defaults to 'commit'.
    strategy: ""

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
- `prBody`: A multi-line Markdown string containing a formatted table of all the submodules
  that were updated, intended for use in a pull request body.

### Dynamic Outputs

As well as the static outputs, this action will also output the following
variables for each submodule that was updated:

- `${prefix}--updated`: Always set to `true` to indicate that the submodule was updated.
- `${prefix}--path`: The path to the submodule that was updated.
- `${prefix}--url`: The GitHub URL of the submodule that was updated.
- `${prefix}--remoteName`: The name of the remote repository of the submodule
  that was updated. (e.g. `sgoudham/update-git-submodules`)
- `${prefix}--previousShortCommitSha`: The short commit SHA of the submodule
  before it was updated.
- `${prefix}--previousCommitSha`: The commit SHA of the submodule before it
  was updated.
- `${prefix}--latestShortCommitSha`: The short commit SHA of the submodule
  after it was updated.
- `${prefix}--latestCommitSha`: The commit SHA of the submodule after it was
  updated.
- `${prefix}--previousTag`: The latest tag of the submodule before it was updated. **May not exist if the submodule does not have any tags.**
- `${prefix}--latestTag`: The tag that the submodule was updated to. **Only available when the strategy is set to 'tag'.**
- `${prefix}--prBody`: A multi-line Markdown string intended for use in a pull request body.

The `${prefix}` is the submodule name or the submodule path if the name is
different to the path. For example, if the submodule is named `vscode-icons` and
the path is `ports/vscode-icons`, the dynamic outputs will be:

- `vscode-icons--updated`
- `vscode-icons--path`
- `vscode-icons--url`
- `vscode-icons--remoteName`
- `vscode-icons--previousShortCommitSha`
- `vscode-icons--previousCommitSha`
- `vscode-icons--latestShortCommitSha`
- `vscode-icons--latestCommitSha`
- `vscode-icons--previousTag`
- `vscode-icons--latestTag`
- `vscode-icons--prBody`
- `ports/vscode-icons--updated`
- `ports/vscode-icons--path`
- `ports/vscode-icons--url`
- `ports/vscode-icons--remoteName`
- `ports/vscode-icons--previousShortCommitSha`
- `ports/vscode-icons--previousCommitSha`
- `ports/vscode-icons--latestShortCommitSha`
- `ports/vscode-icons--latestCommitSha`
- `ports/vscode-icons--previousTag`
- `ports/vscode-icons--latestTag`
- `ports/vscode-icons--prBody`

## Examples

### Update all submodules to the latest commit

```yaml
- name: Update Submodules
  id: submodules
  uses: sgoudham/update-git-submodules@v2.1.3
```

### Update all submodules to the latest tag

```yaml
- name: Update Submodules
  id: submodules
  uses: sgoudham/update-git-submodules@v2.1.3
  with:
    strategy: tag
```

### Update single submodule

```yaml
- name: Update Submodule
  id: submodules
  uses: sgoudham/update-git-submodules@v2.1.3
  with:
    submodules: ports/vscode-icons
```

### Update multiple submodules

```yaml
- name: Update Submodules
  id: submodules
  uses: sgoudham/update-git-submodules@v2.1.3
  with:
    submodules: |
      ports/nvim
      ports/mdBook
      ports/vscode-icons
```

## Creating Pull Requests

### Update single submodule and create pull request

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4
    with:
      submodules: "recursive"
      fetch-depth: 0

  - name: Update Submodules
    id: submodules
    uses: sgoudham/update-git-submodules@v2.1.3

  - name: Create PR
    uses: peter-evans/create-pull-request@v6
    if: ${{ steps.submodules.outputs['vscode-icons--updated'] }}
    with:
      commit-message: "feat: update catppuccin/vscode-icons to ${{ steps.submodules.outputs['vscode-icons--latestShortCommitSha'] }}"
      branch: "feat/update-vscode-icons-${{ steps.submodules.outputs['vscode-icons--latestShortCommitSha'] }}"
      title: "feat: update catppuccin/vscode-icons submodule to ${{ steps.submodules.outputs['vscode-icons--latestShortCommitSha'] }}"
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
    uses: sgoudham/update-git-submodules@v2.1.3

  - name: Create PR
    uses: peter-evans/create-pull-request@v6
    with:
      commit-message: "feat: update all submodules"
      branch: "feat/update-all-submodules"
      title: "feat: update all submodules"
      body: ${{ steps.submodules.outputs.prBody }}
```

### Update multiple submodules and create multiple pull requests

```yaml
jobs:
  update-submodule:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        submodule: [ports/nvim, ports/mdBook, ports/vscode-icons]
        include:
          - submodule: ports/nvim # Update to the latest tag
            strategy: "tag"
            latest: "latestTag"
          - submodule: ports/mdBook # Update to the latest commit
            strategy: "commit"
            latest: "latestShortCommitSha"
          - submodule: ports/vscode-icons # Update to the latest commit
            strategy: "commit"
            latest: "latestShortCommitSha"
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          submodules: "recursive"
          fetch-depth: 0

      - name: Update Submodules
        id: submodules
        uses: sgoudham/update-git-submodules@v2.1.3
        with:
          submodules: ${{ matrix.submodule }}
          strategy: ${{ matrix.strategy }}

      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        if: ${{ steps.submodules.outputs[format('{0}--updated', matrix.submodule)] }}
        with:
          commit-message: "feat: update ${{ matrix.submodule }} to ${{ steps.submodules.outputs[format('{0}--{1}', matrix.submodule, matrix.latest)] }}"
          branch: "feat/update-${{ matrix.submodule }}-${{ steps.submodules.outputs[format('{0}--{1}', matrix.submodule, matrix.latest)] }}"
          title: "feat: update ${{ matrix.submodule }} submodule to ${{ steps.submodules.outputs[format('{0}--{1}', matrix.submodule, matrix.latest)] }}"
          body: ${{ steps.submodules.outputs.prBody }}
```

<!-- x-release-please-end -->

## License

[MIT](./LICENSE)
