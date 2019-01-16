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
- License for [https://www.teamdev.com/dotnetbrowser](DotNetBrowser) (it must put into the git-ignored folder `\licenses\{Configuration}` where `{Configuration}` is Debug (dev license) or Release (runtime license)). It will be picked up by msbuild and put into the correct location. These licenses should _not_ be commited to source control

### Releasing

From PowerShell, run

```
cd build
.\Release.ps1
```

Under the hood this calls `Bump-Version.ps1` and `Build.ps1`. These can be run separately if necessary

By default `Release.ps1` will bump the Minor version of the package (versions live in three spots: manifest, AssemblyInfo, SolutionInfo).

`Build.ps1` will restore, build, unit test, and generate all output in \build\artifacts\\{Platform}\\{Configuration}. The resulting extension artifact in that directory is called `codestream-vs.vsix`

### Build

1. From a terminal, where you have cloned the `codestream-lsp-agent` repository, execute the following command to re-build the agent from scratch:

   ```
   npm run rebuild
   ```

   Or to just run a quick build, use:

   ```
   npm run build
   ```

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

#### Language Server

CodeStream.VisualStudio uses an LSP client library from Microsoft. There are some caveats to using it -- as it is only allowed to be instantiated after a certain file (content) type is opened in the editor.

This sample creates a mock language server using the [common language server protocol](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md) and a mock language client extension in Visual Studio. For more information on how to create language server extensions in Visual Studio, please see [here](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension).

**Related topics**

- [Language Server Protocol](https://docs.microsoft.com/en-us/visualstudio/extensibility/language-server-protocol)
- [Creating a language server extension in Visual Studio](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension)
- [ Visual Studio SDK Documentation ](https://docs.microsoft.com/en-us/visualstudio/extensibility/visual-studio-sdk)

#### Menu and Commands

Menus are attached to the VisualStudio shell with a `.vsct` file. Here, they are contained in the `CodeStreamPackage.vsct` file. It is a _very_ fragile file: there is no intellisense, and any issues won't be known until runtime -- there will be no errors, just that the menus won't show up! It's highly recommend to install Mads Kristensen's ExtensibilityTools (see Tools). It will give intellisense, as well as a way to synchronize all the names/guids with a .cs file (ours is `CodeStreamPackageVSCT.cs`)

### Issues

- Occassionaly, VisualStudio will alert an error message with a path to a log file ending with ActivityLog.xml. This is usually a result of a MEF component not importing correctly. The path to the log file will be something like `C:\Users\{user}\AppData\Roaming\Microsoft\VisualStudio\{VisualStudioVersion}\ActivityLog.xml`. Be sure to open that file with Internet Explorer, as it will format it nicely as html.
- Related, MEF can get into a bad state and clearing the MEF cache can sometimes resolve issues where `Export`ed/`Import`ed components are failing. See Tools.

### Tools

Highly recommend installing: https://marketplace.visualstudio.com/items?itemName=MadsKristensen.ExtensibilityTools (Clearing MEF cache, VSCT support)
