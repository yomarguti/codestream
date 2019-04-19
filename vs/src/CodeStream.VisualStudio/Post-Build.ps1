param([string] $ConfigurationName)
if($ConfigurationName -eq "Debug") {
	pushd ..\..\..\..\..\build
	& .\Extract-Pdb.ps1
	popd
}
