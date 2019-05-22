.\Bump-Version.ps1 -BumpMinor
.\Build.ps1 -Mode Release
ii .\artifacts\x86\Release
& "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\VSIXInstaller.exe" .\artifacts\x86\Release\codestream-vs.vsix