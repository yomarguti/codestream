param(
[string] $ConfigurationName,
[string] $SolutionDir,
[string] $TargetDir
)
if ($ConfigurationName -eq "Debug") {
	pushd ..\..\..\..\..\build
	& .\Extract-Pdb.ps1
	popd
}

xcopy /E /Y "$($SolutionDir)..\publish" "$($TargetDir)publish\"
