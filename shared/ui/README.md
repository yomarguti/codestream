## Usage

1.  clone the repo
2.  `cd` into it
3.  run `npm link`
4.  run `yarn` (if you don't have that, you can install it from [here](https://yarnpkg.com/en/docs/install#mac-stable))
5.  in your other repositories that will use this as dependency, run `npm link codestream-components`
6.  before you start developing, run `yarn build-watch` to have the bundle generated automatically after you make changes

## In VS Code

You'll need to do a build step when there are new changes to `codestream-components`.

From within the `vscode-codestream` repo, `cd /assets/client` and run `npm run vscode-bundle`.
