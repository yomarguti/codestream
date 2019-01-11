# CodeStream for Visual Studio

### Getting the code

```
git clone https://github.com/TeamCodeStream/vs-codestream.git
```
👉 **NOTE!** Make sure to clone the `vs-codestream` repository into a folder that is a sibling of the `vscode-codestream`, `codestream-component`, and `codestream-lsp-agent` repositories

Prerequisites

- Windows 10
- [Visual Studio 2017](https://visualstudio.microsoft.com/downloads/)
- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/), `>= 8.9.1, < 9.0.0`
- [npm](https://npmjs.com/), `>= 6.2.0`
- License for [https://www.teamdev.com/dotnetbrowser](DotNetBrowser)

### Build

1. From a terminal, where you have cloned the `codestream-lsp-agent` repository, execute the following command to re-build the agent from scratch:

   ```
   npm run rebuild
   ```

   Or to just run a quick build, use:

   ```
   npm run build
   ```

1. Ensure the DotNewBrowser _developer_ license (`teamdev.licenses`) is copied into `licenses/Debug/`

1. Ensure the DotNewBrowser _runtime_ license (`teamdev.licenses`) is copied into `licenses/Release/`

1. TBD

### Watch (Agent only)

During development you can use a watcher to make builds on changes quick and easy. From a terminal, where you have cloned the `codestream-lsp-agent` repository, execute the following command:

```
npm run watch
```

It will do an initial full build and then watch for file changes, compiling those changes incrementally, enabling a fast, iterative coding experience.

### Debugging

#### Using Visual Studio

1. Ensure that the agent has been build or that the watcher is running (see the _Watch_ section above)
1. Open the solution (`src/CodeStream.VisualStudio.sln`),
1. Press `F5` to build and run the solution. This will open a new "experimental" version of Visual Studio.

### Notes

CodeStream.VisualStudio uses an LSP client library from Microsoft. There are some caveats to using it -- as it is only allowed to be instantiated after a certain file (content) type is opened in the editor.

This sample creates a mock language server using the [common language server protocol](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md) and a mock language client extension in Visual Studio. For more information on how to create language server extensions in Visual Studio, please see [here](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension).

**Related topics**

- [Language Server Protocol](https://docs.microsoft.com/en-us/visualstudio/extensibility/language-server-protocol)
- [Creating a language server extension in Visual Studio](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension)
- [ Visual Studio SDK Documentation ](https://docs.microsoft.com/en-us/visualstudio/extensibility/visual-studio-sdk)
