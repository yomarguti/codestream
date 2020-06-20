param(
[string] $ConfigurationName,
[string] $SolutionDir,
[string] $ProjectDir,
[string] $TargetDir
)
Write-Host ""
Write-Host "VS Pre-Build.ps1 Starting..."
Write-Host ""

Write-Host "ProjectDir=$($ProjectDir)"
Write-Host "SolutionDir=$($SolutionDir)"
Write-Host "TargetDir=$($TargetDir)"
$LicenseFile = "$($SolutionDir)..\licenses\$($ConfigurationName)\teamdev.licenses"
Write-Host "LicenseFile=$($LicenseFile)"
$LocalLicenseFile = "$($ProjectDir)teamdev.licenses"
Write-Host "LocalLicenseFile=$($LocalLicenseFile)"

Write-Host "local license file '$($LocalLicenseFile)'..."
if ((Test-Path -Path $LocalLicenseFile)) {	
	Remove-Item $LocalLicenseFile -Force
	Write-Host "Deleting old licenses completed."
}
else {
	Write-Host "NOT deleting old licenses (doesn't exist) '$($ProjectDir)teamdev.licenses'..."
}

Write-Host "Copying license to src..."
if (!(Test-Path -Path $LicenseFile)) {
 	Write-Host "LicenseFile not found LicenseFile=$($LicenseFile)"
 	exit 1
}
Copy-Item $LicenseFile -Destination $ProjectDir
Write-Host "Copying licenses completed."

Write-Host ""
Write-Host "VS Pre-Build.ps1 Completed"
Write-Host ""
