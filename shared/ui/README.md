## Usage

1.  clone the repo
2.  `cd` into it
3.  run `npm link`
4.  run `yarn` (if you don't have that, you can install it from [here](https://yarnpkg.com/en/docs/install#mac-stable))
5.  before you start developing, run `yarn build-watch` in the root directory of the codestream-components repository to have the bundle generated automatically after you make changes

You will have to make sure step 5 is always running when you're doing development, otherwise you won't see changes you make to the codestream-components repo.

## In Atom

### Setup

1.  cd to the root directory of your atom repo.
2.  run `npm link codestream-components`.

### Workflow

Yarn build-watch will rebuild the package every time it notices a change on disk, so the workflow is:

1.  make sure yarn build-watch is running (see above).
2.  make your edits in your editor.
3.  wait a few seconds for yarn buld-watch to complete
4.  reload Atom to see your changes.

## In VS Code

### Setup

1.  cd to the root directory of your vscode-codestream repo.
2.  cd `assets/client`
3.  run `npm link codestream-components`.

### Workflow

You'll need to do a build step when there are new changes to `codestream-components`.
From within the `vscode-codestream` repo, `cd /assets/client` and run `npm run vscode-bundle`.
You need to do this every time there is a change to codestream-components, so the steps are:

1.  make sure yarn build-watch is running (see above).
2.  make your edits in your editor.
3.  wait a few seconds for yarn buld-watch to complete
4.  go to a terminal and From within the `vscode-codestream` repo, `cd /assets/client` and run `npm run vscode-bundle`.
5.  reload vscode to see your changes

this can take 15+ seconds. further improvements to this process are planned.
