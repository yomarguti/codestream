param([string] $checkoutDir = $pwd, [string] $assetEnv = "", [string] $buildNumber = $env:build_number)

Write-Host '**** The script is running in directory' (Get-Location)
$buildDir = $checkoutDir + '\vs-codestream\build'
$assetDir = $buildDir + '\artifacts\x86\Release'
$vsce = $checkoutDir + '\vs-codestream\node_modules\.bin\vsce'

$asset = $assetDir + '\codestream-vs-' + $buildNumber + '.vsix'
Write-Host 'Here is the VSIX file (' $asset '):'
Get-ChildItem $asset

$assetInfo = $assetDir + '\codestream-vs-' + $buildNumber + '.info'
Write-Host 'Here is the VSIX file (' $assetInfo '):'
Get-ChildItem $assetInfo

Write-Host 'Publishing asset to marketplace'
Write-Host "$vsce publish --packagePath $asset"
# $vsce publish --packagePath $asset
