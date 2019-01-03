param (
    [string]$configuration = "Release",
    [double]$visualStudioVersion = 15.0,
    [boolean]$deployExtension = $false
)

# build vscode-codestream (npm run rebuild)

# npm install pkg -g

#https://stackoverflow.com/questions/42874400/how-to-build-a-visual-studio-2017-vsix-using-msbuild
$msbuild = "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\MSBuild\15.0\Bin\msbuild.exe"

pkg ..\src\CodeStream.VisualStudio\LSP\agent-cli.js --targets node8-win-x86 --out-path ..\src\CodeStream.VisualStudio\LSP\

$OutputDir = $($PSScriptRoot+"\artifacts");
Remove-Item $($PSScriptRoot+"\artifacts\*") -Recurse -Force

# move devteam DotNetBrowser runtime license into ..\src\CodeStream.VisualStudio

& $msbuild ..\src\CodeStream.VisualStudio.sln /v:normal /target:Clean /target:Build /p:Configuration=$configuration /p:Platform=x86 /p:DeployExtension=$deployExtension /p:VisualStudioVersion=$visualStudioVersion /p:OutputPath=$OutputDir