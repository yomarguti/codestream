# CodeStream LSP Agent

### Getting the code

```
git clone https://github.com/TeamCodeStream/codestream-lsp-agent.git
```

👉 **NOTE!** Make sure to clone the `codestream-lsp-agent` repository into a folder that is a sibling of the `vscode-codestream` repository

Prerequisites

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/), `>= 8.9.1, < 9.0.0`
- [npm](https://npmjs.com/), `>= 6.2.0`

### Build

From a terminal, where you have cloned the repository, execute the following command to re-build the agent from scratch:

```
npm run rebuild
```

Or to just run a quick build, use:

```
npm run build
```

### Watch

During development you can use a watcher to make builds on changes quick and easy. From a terminal, where you have cloned the repository, execute the following command:

```
npm run watch
```

It will do an initial full build and then watch for file changes, compiling those changes incrementally, enabling a fast, iterative coding experience.

👉 **Tip!** Open VS Code to the folder where you have cloned the repository and press <kbd>CMD+SHIFT+B</kbd> (<kbd>CTRL+SHIFT+B</kbd> on Windows, Linux) to start the build. To view the build output open the Output stream by pressing <kbd>CMD+SHIFT+U</kbd>.

### Formatting

We use [prettier](https://prettier.io/) for formatting our code. You can run prettier across the code by calling `npm run pretty` from a terminal.

To format the code as you make changes you can install the [Prettier - Code formatter](https://marketplace.visualstudio.com/items/esbenp.prettier-vscode) extension.

### Linting

We use [tslint](https://palantir.github.io/tslint/) for linting our code. You can run tslint across the code by calling `npm run lint` from a terminal. Warnings from tslint show up in the `Errors and Warnings` quick box and you can navigate to them from inside VS Code.

To lint the code as you make changes you can install the [TSLint](https://marketplace.visualstudio.com/items/eg2.tslint) extension.

### Testing

To run the agent unit tests run the following from a terminal:

```
npm run test
```

### Bundling

To generate a production bundle run the following from a terminal:

```
npm run bundle
```

### Debugging

#### Using VS Code

- Open the `codestream-lsp-agent` repository folder
- Choose the `Attach to Agent` launch configuration from the launch dropdown in the Debug viewlet and press `F5`.
