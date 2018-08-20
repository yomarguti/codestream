# CodeStream for Visual Studio Code

### Getting the code

```
git clone https://github.com/TeamCodeStream/vscode-codestream.git
```

👉 **NOTE!** Make sure to clone the `vscode-codestream` repository into a folder that is a sibling of the `codestream-component` and `codestream-lsp-agent` repositories

Prerequisites

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/), `>= 8.9.1, < 9.0.0`
- [npm](https://npmjs.com/), `>= 6.2.0`

### Warnings

👉 Do NOT make changes to the files in `src/shared` they are files copied in from `codestream-lsp-agent` and need to be modified there.

### Build

From a terminal, where you have cloned the repository, execute the following command to re-build the agent from scratch:

```
npm run rebuild
```

👉 **NOTE!** This will run a complete rebuild of the extension, webview, and agent.

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

To watch the extension and agent, use the following in separate terminals:

```
npm run watch
npm run agent:watch
```

Or use the provided `watch` task in VS Code, execute the following from the command palette (be sure there is no `>` at the start):

```
task watch
```

👉 **Tip!** If you only want to watch for changes in the webview you can execute the following command:

```
npm run webview:watch
```

👉 **Tip!** Open VS Code to the folder where you have cloned the repository and press <kbd>CMD+SHIFT+B</kbd> (<kbd>CTRL+SHIFT+B</kbd> on Windows, Linux) to start the build. To view the build output open the Output stream by pressing <kbd>CMD+SHIFT+U</kbd>. This will run the `watch` task.

👉 **Tip!** You don't need to stop and restart the development version of Code after each change. You can just execute `Reload Window` from the command palette. We like to assign the keyboard shortcut <kbd>CMD+R</kbd> (<kbd>CTRL+R</kbd> on Windows, Linux) to this command.

### Formatting

We use [prettier](https://prettier.io/) for formatting our code. You can run prettier across the code by calling `npm run pretty` from a terminal.

To format the code as you make changes you can install the [Prettier - Code formatter](https://marketplace.visualstudio.com/items/esbenp.prettier-vscode) extension.

Add the following to your User Settings to run prettier:

`"editor.formatOnSave": true,`

### Linting

We use [tslint](https://palantir.github.io/tslint/) for linting our code. You can run tslint across the code by calling `npm run lint` from a terminal. Warnings from tslint show up in the `Errors and Warnings` quick box and you can navigate to them from inside VS Code.

To lint the code as you make changes you can install the [TSLint](https://marketplace.visualstudio.com/items/eg2.tslint) extension.

### Testing

To run the unit tests (currently only for the agent) run the following from a terminal:

```
npm run test
```

### Bundling

To generate a production bundle (without packaging) run the following from a terminal:

```
npm run bundle
```

To generate a VSIX (installation package) run the following from a terminal:

```
npm run bundle
npm run pack
```

### Configuration

| Name                       | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| `codestream.autoSignIn`    | Specifies whether to automatically sign in to CodeStream                         |
| `codestream.avatars`       | Specifies whether to show avatars                                                |
| `codestream.email`         | Specifies the email to use to connect to the CodeStream service                  |
| `"codestream.markerStyle`  | Specifies the indicator style to use for CodeStream code markers                 |
| `codestream.notifications` | Specifies when to show notifications for incoming messages                       |
| `codestream.password`      | Specifies the password to use to connect to the CodeStream service               |
| `codestream.reduceMotion`  | Specifies whether to reduce animation/transition motions                         |
| `codestream.serverUrl`     | Specifies the url to use to connect to the CodeStream service                    |
| `codestream.team`          | Specifies an optional team to use to connect to the CodeStream service           |
| `codestream.traceLevel`    | Specifies how much (if any) output will be sent to the CodeStream output channel |
| `codestream.webAppUrl`     | Specifies the url to use to connect to the CodeStream web app                    |

### Debugging

#### Using VS Code

- Open the `vscode-codestream` repository folder
- Choose the `Launch CodeStream` launch configuration from the launch dropdown in the Debug viewlet and press `F5`.

### Downloading Built VSIXs

Here are the download links for pre-built vsix bundles:

- **CI**: https://assets.codestream.com/local/vscode/codestream-latest.vsix
- **PD**: https://assets.codestream.com/pd/vscode/codestream-latest.vsix
- **QA**: https://assets.codestream.com/qa/vscode/codestream-latest.vsix
- **Production**: https://assets.codestream.com/prod/vscode/codestream-latest.vsix

### Connecting to a CodeStream environment

Probably the easiest way to switch between environments is to create separate workspace files for each using the example workspace files below.

#### Connecting to the PD environment

Use the following settings:

```json
"codestream.serverUrl": "https://pd-api.codestream.us:9443",
"codestream.webAppUrl": "http://pd-app.codestream.us:1380",
"codestream.email": "<email>",
"codestream.team": "<team>", // Shouldn't really be needed unless there are issues and you belong to more than 1 team
```

Example workspace file &mdash; save as pd.code-workspace

```json
{
	"folders": [
		{
			"path": "<absolute or relative folder path here>"
		}
	],
	"settings": {
		"codestream.serverUrl": "https://pd-api.codestream.us:9443",
		"codestream.webAppUrl": "http://pd-app.codestream.us:1380",
		"codestream.email": "<email>",
		"codestream.team": "<team>" // Shouldn't really be needed unless there are issues and you belong to more than 1 team
	}
}
```

#### Connecting to the QA environment

Use the following settings:

```json
"codestream.serverUrl": "https://qa-api.codestream.us",
"codestream.webAppUrl": "http://qa-app.codestream.us",
"codestream.email": "<email>",
"codestream.team": "<team>", // Shouldn't really be needed unless there are issues and you belong to more than 1 team
```

Example workspace file &mdash; save as qa.code-workspace

```json
{
	"folders": [
		{
			"path": "<absolute or relative folder path here>"
		}
	],
	"settings": {
		"codestream.serverUrl": "https://qa-api.codestream.us",
		"codestream.webAppUrl": "http://qa-app.codestream.us",
		"codestream.email": "<email>",
		"codestream.team": "<team>" // Shouldn't really be needed unless there are issues and you belong to more than 1 team
	}
}
```

#### Connecting to the Production environment

Use the following settings:

```json
"codestream.email": "<email>",
"codestream.team": "<team>", // Shouldn't really be needed unless there are issues and you belong to more than 1 team
```

Example workspace file &mdash; save as prod.code-workspace

```json
{
	"folders": [
		{
			"path": "<absolute or relative folder path here>"
		}
	],
	"settings": {
		"codestream.email": "<email>",
		"codestream.team": "<team>" // Shouldn't really be needed unless there are issues and you belong to more than 1 team
	}
}
```
