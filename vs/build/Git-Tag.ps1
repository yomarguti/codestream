[CmdletBinding(SupportsShouldProcess)]
param([string] $checkoutDir = $pwd, [string] $assetEnv = "", [string] $buildNumber = $env:build_number)

Write-Host '**** The script is running in directory' (Get-Location)
$vsDir = $checkoutDir + '\vs'
$buildDir = $vsDir + '\build'
$assetDir = $buildDir + '\artifacts\x86\Release'
$assetInfo = $assetDir + '\codestream-vs-' + $buildNumber + '.info'

Write-Host 'Here is the VSIX asset file (' $assetInfo '):'
Get-ChildItem $assetInfo

$commitId = (Get-Content -Raw -Path $assetInfo | ConvertFrom-Json).repoCommitId.codestream_vs

# uses .net version parsing!
$v = [System.Version]::Parse((Get-Content -Raw -Path $assetInfo | ConvertFrom-Json).version)
$version = $"$($v.Major).$($v.Minor).$($v.Build)"

$gitCommand = "git tag -a vs-$version $commitId"
 
if ($WhatIfPreference.IsPresent -eq $True) {
    Write-Host "would have run: $gitCommand"
    Write-Host "would have run: 'git push'"
}
else {
    iex $gitCommand
    Write-Host "git tag complete"
    git push
    Write-Host "git push complete"
}
