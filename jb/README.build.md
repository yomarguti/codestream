# JetBrains Plugin Build Information

TeamCity Project: [JetBrains](http://tc.codestream.us/project/JetBrians)

## GitFlow and Brief Overview
Read the [Build Overview](https://teamcodestream.atlassian.net/wiki/x/04BID) page on the Ops Wiki site.

## Assets
| Type | Desc |
| --- | --- |
| info | asset info file |
| zip | Intellij extension |

| Asset Env | Asset | Location |
| --- | --- | --- |
| dev | zip | [TeamCity CI build artifact](http://tc.codestream.us/buildConfiguration/JetBrains_Ci) |
| prod | zip | [TeamCity Prod Integration build artifact](http://tc.codestream.us/buildConfiguration/JetBrains_ProdIntegration) |

## Builds

[Standard build descriptions are here](https://github.com/TeamCodeStream/teamcity_tools/blob/master/README.project-build-types.md#standard-project-builds)

### Other Builds

| Build | Execution |
| --- | --- |
| CI Nightly | Upload latest dev asset (from CI build) to [JetBrains Plugin Verification service](https://github.com/JetBrains/intellij-plugin-verifier) to the **nightly** channel every night at midnight |
