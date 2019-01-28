param([string] $checkoutDir = $pwd, [string] $assetEnv = "")

$codestreamVsDir = $checkoutDir + '\vs-codestream'
$codestreamComponentsDir = $checkoutDir + '\codestream-components'
$codestreamLspAgentDir = $checkoutDir + '\codestream-lsp-agent'
$buildDir = $checkoutDir + '\vs-codestream\build'
$assetDir = $buildDir + '\artifacts\x86\Release'

Write-Host '**** changing to buildDir' $buildDir
cd $buildDir
Write-Host '**** Working directory is' (Get-Location)
. .\modules.ps1 | out-null
. .\Modules\Versioning.ps1 | out-null
$codeVer = Read-Version
Write-Host '***** codeVer: ' $codeVer
$assetVer = $codeVer + '+' + $env:build_number
Write-Host '***** asset version: ' $assetVer
$assetsBaseName = 'codestream-vs-' + $assetVer

$commitIds = @{}
cd $codestreamVsDir
$commitIds.codestream_vs = git rev-parse HEAD
cd $codestreamComponentsDir
$commitIds.codestream_components = git rev-parse HEAD
cd $codestreamLspAgent
$commitIds.codestream_lsp_agent = git rev-parse HEAD

$assetInfo = @{}
$assetInfo.assetEnvironment = $assetEnv
$assetInfo.name = "codestream-vs"
$assetInfo.version = $codeVer
$assetInfo.buildNumber = $env:build_number
$assetInfo.repoCommitId = $commitIds
$infoFileName = $assetDir + '\' + $assetsBaseName + '.info'
Write-Host '********** Creating ' $infoFileName
$assetInfo | ConvertTo-Json | Out-File $infoFileName

$newAssetName = $assetsBaseName + '.vsix'
Write-Host '********** Renaming vsix to ' $newAssetName
cd $assetDir
mv codestream-vs.vsix $newAssetName
