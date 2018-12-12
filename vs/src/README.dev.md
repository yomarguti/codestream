# CodeStream Extension for Visual Studio

### Getting the code

```
git clone https://github.com/TeamCodeStream/vs-codestream.git
```

### Prerequisites

- Windows 10
- [Visual Studio 2017](https://visualstudio.microsoft.com/downloads/)
- License for [https://www.teamdev.com/dotnetbrowser](DotNetBrowser)

- checkout codestream-lsp-agent/feature/visual-studio and ensure it is and `npm run watch` this will build and watch `agent-cli.ts`

### Build / Run

Press `F5` to build and run the solution. A new "experimental" version of Visual Studio will open.

#### Not working?

- Ensure `C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe` exists
- Ensure vs-codestream and codestream-lsp-agent are sibling repos
- Ensure the agent watch is running
- Ensure your DotNetBrowser license works

### Notes

CodeStream.VisualStudio uses an LSP client library from Microsoft. There are some caveats to using it -- as it is only allowed to be instantiated after a certain file (content) type is opened in the editor.

This sample creates a mock language server using the [common language server protocol](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md) and a mock language client extension in Visual Studio. For more information on how to create language server extensions in Visual Studio, please see [here](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension).

**Related topics**

- [Language Server Protocol](https://docs.microsoft.com/en-us/visualstudio/extensibility/language-server-protocol)
- [Creating a language server extension in Visual Studio](https://docs.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension)
- [ Visual Studio SDK Documentation ](https://docs.microsoft.com/en-us/visualstudio/extensibility/visual-studio-sdk)
