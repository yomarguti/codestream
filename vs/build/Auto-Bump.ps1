[CmdletBinding(SupportsShouldProcess)]
param([string] $checkoutDir = $pwd, [string] $assetEnv = "")

# this creates a temporary directory
# see: https://stackoverflow.com/a/41684596
$tempDir = (New-TemporaryFile | %{ rm $_; mkdir $_ }).ToString()
Write-Host "Created $($tempDir)"
$branch = "develop"
pushd $tempDir
iex "git clone --depth 1 https://github.com/TeamCodeStream/codestream -b $($branch)"
    pushd codestream
        pushd vs\build
            .\Bump-Version.ps1 -BumpPatch
            $newVersion = (.\Get-Version.ps1).ToString()        
        popd
    $message = "Auto bump version on $($branch) to $($newVersion) for next release"
    git commit -am $message
    if ($WhatIfPreference.IsPresent -eq $True) {
        Write-Host "would have run 'git push'"
    }
    else {
        git push
        Write-Host "git push complete"
    }
    Write-Host $message
    popd
popd
Write-Host "Removing $($tempDir)..."
Remove-Item $tempDir -Recurse -Force
Write-Host "Removed $($tempDir)"