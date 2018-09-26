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


## Production Release (untested / unconfirmed, more details needed)
1. Tag the **vscode-codestream**, **codestream-lsp-agent** and **codestream-components** repos with the lightweight tag **vscode-X.Y.Z**.
1. Copy the assets to the CloudFront distribution.  
`vscsb-publish-assets-to-cloudfront --asset-env prod`
1. Deploy the extension to the Visual Studio Marketplace.


## Hotfixing (untested / unconfirmed, more thought needed)

1. we need a reliable way to do this with TC
