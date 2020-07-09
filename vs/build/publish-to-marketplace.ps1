[CmdletBinding(SupportsShouldProcess)]
param([string] $checkoutDir = $pwd, [string] $assetEnv = "", [string] $buildNumber = $env:build_number)

$homeDir = 'C:\Users\Administrator'
$localVSCETokenFile = $homeDir + '\.vsce'

Write-Host '**** The script is running in directory' (Get-Location)
$vsDir = $checkoutDir + '\vs'
$buildDir = $vsDir + '\build'
$assetDir = $buildDir + '\artifacts\x86\Release'

$asset = $assetDir + '\codestream-vs-' + $buildNumber + '.vsix'
Write-Host 'Here is the VSIX file (' $asset '):'
Get-ChildItem $asset

$assetInfo = $assetDir + '\codestream-vs-' + $buildNumber + '.info'
Write-Host 'Here is the VSIX file (' $assetInfo '):'
Get-ChildItem $assetInfo

$pat = (Get-Content -Raw -Path $localVSCETokenFile | ConvertFrom-Json).publishers.Where({$_.Name -eq "CodeStream"}).pat
Write-Host "Got PAT"

$path = (& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -products 'Microsoft.VisualStudio.Product.BuildTools' -latest -property installationPath)
Write-Host $path
$exe = (-join($path, "\VSSDK\VisualStudioIntegration\Tools\Bin\VsixPublisher.exe"))
Write-Host "VsixPublish path... $($exe)"

if ($WhatIfPreference.IsPresent -eq $True) {
    Write-Host "Would have published $($asset)"
}
else {
    Write-Host 'Publishing asset to marketplace...'
    # https://docs.microsoft.com/en-us/visualstudio/extensibility/walkthrough-publishing-a-visual-studio-extension-via-command-line?view=vs-2019
    #  -ignoreWarnings "VSIXValidatorWarning01,VSIXValidatorWarning02"
    & $exe publish -payload $asset -publishManifest "$($vsDir)\publishManifest.json" -personalAccessToken $pat
}
