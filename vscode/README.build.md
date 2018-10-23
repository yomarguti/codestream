# VSCode Extension Build & Deployment Information

TeamCity Project: [vscode-codestream](http://tc.codestream.us/project.html?projectId=VscodeCodestream&tab=projectOverview)  

## Assets
The assets are a VSIX file packaging of the extension and a json file containing information about the build.

Assets: **codestream-$VERSION+$BUILD.{vsix,info}**  
Internal Asset Location:  
* **http://assets.codestream.us/artifacts/dev/vscode-codestream/**  
* **http://assets.codestream.us/artifacts/prod/vscode-codestream/**  

Public Assets (prod releases only):  
* **https://assets.codestream.com/vscode/codestream-latest.info**  
* **https://assets.codestream.com/vscode/codestream-latest.vsix**


## Branches

| Branch | Description |
| --- | --- |
| develop | All work lands here. Used for CI build |
| master | Pre-relase work lands here. Used for Prod build |
| hotfix_* | branch name prefix for branches made off the **master** branch for hotfixing |

## Builds

There are 2 builds; one for the develop branch (Continuous Integration) and one for the master branch (Production).

| Build | Asset Env | Execution |
| --- | --- | --- |
| [CI](http://tc.codestream.us/viewType.html?buildTypeId=VscodeCodestream_Ci) | [dev](http://assets.codestream.us/artifacts/dev/vscode-codestream/) | Triggered by updates to the **develop** branch and PR's.<br>Build dev assets on TC agent, run tests and publish the artifacts for internal distribution. |
| [Prod](http://tc.codestream.us/viewType.html?buildTypeId=VscodeCodestream_Prod) | [prod](http://assets.codestream.us/artifacts/prod/vscode-codestream/) | Triggered by updates to the **master** branch.<br>Build prod assets on TC agent, run tests and publish the artifacts for internal distribution. |
| [Prod Release](http://tc.codestream.us/viewType.html?buildTypeId=VscodeCodestream_ProductionRelease) | | Tag the repositories for the release.<br>Bump the version number in package.json if need be.<br>Copy prod asset to assets.codestream.com.<br>Submit vsix file to the Visual Studio Marketplace.<br>[Watch submission progress here](https://marketplace.visualstudio.com/manage/publishers/CodeStream).<br>[Azure DevOps site is here](https://teamcodestream.visualstudio.com). |


## Hotfixing (untested / unconfirmed, more thought needed)
1. If the **master** branch already represents the version being hotfixed, create the fix on the HEAD of **master** and let TeamCity create the new asset as usual. Remember to bump the version patch number in package.json and follow the Production Release instructions above.
1. Otherwise, we need a reliable way to do this with TC
