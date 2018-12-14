param (
    [string]$configuration = "Release"    
)

#https://stackoverflow.com/questions/42874400/how-to-build-a-visual-studio-2017-vsix-using-msbuild
$msbuild = "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\MSBuild\15.0\Bin\msbuild.exe"

& $msbuild ..\src\CodeStream.VisualStudio.sln /v:normal /target:Clean /target:Build /p:Configuration=$configuration /p:Platform=x86 /p:DeployExtension=false /p:VisualStudioVersion=15.0 