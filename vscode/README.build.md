# VSCode Extension Builds

TeamCity Project: [Visual Studio Code](http://tc.codestream.us/project/VisualStudioCode)


## GitFlow and Brief Overview
Read the [Build Overview](https://teamcodestream.atlassian.net/wiki/x/04BID) page on the Ops Wiki site.

## Assets
| Type | Desc |
| --- | --- |
| info | asset info file |
| vsix | VS Code extension |

| Asset Env | Asset | Location |
| --- | --- | --- |
| dev | vsix | [TeamCity CI build artifact](http://tc.codestream.us/buildConfiguration/VisualStudioCode_Ci) |
| prod | vsix | [TeamCity Prod Integration build artifact](http://tc.codestream.us/buildConfiguration/VisualStudioCode_ProdIntegration) |

## Builds

[see standard builds for descriptions](https://github.com/TeamCodeStream/teamcity_tools/blob/master/README.project-build-types.md#standard-project-builds)
