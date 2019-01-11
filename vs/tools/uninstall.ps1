[CmdletBinding(PositionalBinding=$false)]
Param( 
    [Parameter(Mandatory=$true)]
    [ValidateSet("vs2017", "vs2019")]
    [Alias("v")]
    [System.String] $Version
)

Write-Host $Version
$path = ""
$uninstall = $false
if ($Version -eq "vs2019") {
	$path = "C:\Program Files (x86)\Microsoft Visual Studio\2019\Preview\Common7\IDE"
	if ((Test-Path -path $path)) {		
		$uninstall = $true
	}
}
elseif ($Version -eq "vs2017") {
$path = "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\Common7\IDE"
	if ((Test-Path -path $path)) {
		$uninstall = $true
	}
}
	
	
if($uninstall -eq $true) {	
	Write-Host $Version
	& "$($path)\VSIXInstaller.exe" /uninstall:codestream-vs
}