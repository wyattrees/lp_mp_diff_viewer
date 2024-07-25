# LP Diff

This VS Code extension enables you to view a side-by-side diff of files changed in a Launchpad merge proposal.

With your VS Code editor open to the corresponding repository of the merge proposal, enter the `LP Diff` command by pressing `Ctrl+Shift+P` and typing "LP Diff"

Then, enter your launchpad username and the url of the Merge Proposal you would like to view.

## Build & Install

To build the extension, run `vsce package` in the root of this repository. This will create a `.vsix` file.

To install the extension, run `code --install-extension $PATH_TO_VSIX_FILE`.

## Features

Files will be diffed one-by-one. When the diff tab is closed, the next one will open.

## Known Issues

- Make sure your repository working tree is clean before running the `LP Diff` command.
- All editor tabs must be closed before running the `LP Diff` command.
- Cleanup does not happen properly. Your git repository will be in a weird configuration. To clean it:

```bash
git checkout master # or main
git reset HEAD --hard
# maybe remove any extra files lying around
git remote remove lp-diff-target
git remote remove lp-diff-src
```

## Release Notes

### 0.0.1

Initial release, probably buggy.
