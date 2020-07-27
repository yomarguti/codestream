# CodeStream for Jetbrains

### Getting the code

```
git clone https://github.com/TeamCodeStream/codestream.git
```

Versions

- [Git](https://git-scm.com/), 2.17.1
- [NodeJS](https://nodejs.org/en/), 10.15.3 (Nov 2019)
- [npm](https://npmjs.com/), 6.11.3 (Dec 2019)

### Before you begin...

The CodeStream clients all live in a single git mono-repo. Each IDE has their own tools for generating builds and Jetbrains is no different!

### Build

From a terminal, where you have cloned the repository, execute the following command to build the agent and CodeStream for Jetbrains extension from scratch:

```
cd jb
npm run rebuild
```

👉 **NOTE!** This will run a complete rebuild of the extension, webview, and agent.

To just run a quick build of the extension, use:

```
cd jb
npm run build
```

To just run a quick build of the agent, use:

```
cd shared/agent
npm run build
```

### In short...

`npm install --no-save`... needs to be run for shared/ui, shared/agent, vscode

`npm run build`... needs to be run for shared/agent _then_ vscode

##### Ubuntu 18.04: 'pushd not found'

If you get a 'pushd not found' error on npm run rebuild, it's because Ubuntu uses sh for the default shell. Tell npm to use bash instead:

Create a file in the vscode folder called

```
.npmrc
```

with content

```
script-shell=/bin/bash
```

### Watch

During development you can use a watcher to automatically updating your running builds on editor code changes. From a terminal, where you have cloned the repository, execute the following command:

```
cd jb
npm run watch
```

It will do an initial full build and then watch for file changes, compiling those changes incrementally, enabling a fast, iterative coding experience.

To watch the extension and agent, from a terminal, where you have cloned the repository, use the following in separate terminals :

```
cd jb
npm run watch
```

```
cd shared/agent
npm run watch
```

Or use the provided `watch` task in VS Code, execute the following from the command palette (be sure there is no `>` at the start):

```
task watch
```

👉 **Tip!** If you only want to watch for changes in the webview you can execute the following command:

```
cd jb
npm run webview:watch
```

### Testing

To run the agent unit tests run the following from a terminal:

```
cd shared/agent
npm run test-acceptance
```

or

```
cd shared/agent
npm run test-unit
```

To run the webview unit tests run the following from a terminal:

```
cd shared/ui
npm run test
```

### Bundling

// TODO

### Debugging

// TODO
