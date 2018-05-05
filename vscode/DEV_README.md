## Build and Run

### Getting the sources
```
git clone https://github.com/TeamCodeStream/vscode-codestream.git
```

Prerequisites
- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/), `>= 8.9.1, < 9.0.0`

Finally, install all dependencies using Yarn:
```
cd vscode-codestream
npm install
```

### Build
From a terminal, where you have cloned the `vscode-codestream` repository, execute the following command to run the TypeScript incremental builder:
```
npm run watch
```
It will do an initial full build and then watch for file changes, compiling those changes incrementally, enabling a fast, iterative coding experience.

👉 **Tip!** Open VS Code to the folder where you have cloned the `vscode-codestream` repository and press <kbd>CMD+SHIFT+B</kbd> (<kbd>CTRL+SHIFT+B</kbd> on Windows, Linux) to start the builder. To view the build output open the Output stream by pressing <kbd>CMD+SHIFT+U</kbd>.

👉 **Tip!** You don't need to stop and restart the development version of Code after each change. You can just execute `Reload Window` from the command palette. We like to assign the keyboard shortcut <kbd>CMD+R</kbd> (<kbd>CTRL+R</kbd> on Windows, Linux) to this command.

### Configuration

#### Connecting to a CodeStream environment

To connect to the PD environment, use the following settings
```json
"codestream.serverUrl": "https://pd-api.codestream.us:9443",
"codestream.email": "<email>",
"codestream.password": "<password>",
"codestream.teamId": "<teamId>", // Shouldn't really be needed unless there are issues and you belong to more than 1 team
```

To connect to the Production environment, use the following settings
```json
"codestream.email": "<email>",
"codestream.password": "<password>",
"codestream.teamId": "<teamId>", // Shouldn't really be needed unless there are issues and you belong to more than 1 team
```

#### Settings
|Name | Description
|-----|------------
|`codestream.debug`|Specifies debug mode
|`codestream.traceLevel`|Specifies how much (if any) output will be sent to the CodeStream output channel
|`codestream.serverUrl`|Specifies the url to use to connect to the CodeStream service
|`codestream.email`|Specifies the email to use to connect to the CodeStream service
|`codestream.password`|Specifies the password to use to connect to the CodeStream service
|`codestream.teamId`|Specifies the optional team to use to connect to the CodeStream service
|`codestream.explorers.enabled`|Specifies whether to show the `CodeStream` explorers
|`codestream.notifications`|Specifies when to show notifications for incoming messages
|`codestream.bot.enabled`|Specifies whether to enable the CodeStream demo bot
|`codestream.bot.email`|Specifies the demo bot's email to use to connect to the CodeStream service
|`codestream.bot.password`|Specifies the demo bot's password to use to connect to the CodeStream service
|`codestream.bot.triggers`|Specifies the demo bot's triggers<br/><br/>Example<br/>```"codestream.bot.triggers": [```<br/>&nbsp;&nbsp;&nbsp;&nbsp;```{ "type": "immediate", "pattern": "\\bhi\\b", "response": { "location": "channel", "message": "Hiya!" } },```<br/>&nbsp;&nbsp;&nbsp;&nbsp;```{ "type": "delayed", "pattern": "\\bhelp me\\b", "response": { "location": "thread", "message": "Sure! Would you like to start a Live Share session?" } }```<br/>```]```

### Debugging

#### Using VS Code
* Open the `vscode-codestream` repository folder
* Choose the `Launch Extension` launch configuration from the launch dropdown in the Debug viewlet and press `F5`.

### Linting
We use [tslint](https://github.com/palantir/tslint) for linting our sources. You can run tslint across the sources by calling `npm run lint` from a terminal. Warnings from tslint show up in the `Errors and Warnings` quick box and you can navigate to them from inside VS Code.

To lint the source as you make changes you can install the [tslint extension](https://marketplace.visualstudio.com/items/eg2.tslint).

### Bundling

To generate a VSIX (installation package) run the following from a terminal
```
npm run pack
```