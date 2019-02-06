Set-StrictMode -Version Latest

New-Module -ScriptBlock {

    function Get-SolutionInfoPath {
        Join-Path $rootDirectory src\CodeStream.VisualStudio\Properties\SolutionInfo.cs
    }

    function Read-VersionSolutionInfo {
        $file = Get-SolutionInfoPath
        $currentVersion = Get-Content $file | %{
         $regex = "const string Version = `"(\d+\.\d+\.\d+.\d+\)`";"
            if ($_ -match $regex) {
                $matches[1]
            }
        }
        [System.Version] $currentVersion
    }

    function Write-SolutionInfo([System.Version]$version, [System.String] $environment) {
        $file = Get-SolutionInfoPath
        $numberOfReplacements = 0
        $newContent = Get-Content $file | %{
            $newString = $_
            
            $regex = "(string Version = `")\d+\.\d+\.\d+\.\d+"
            if ($_ -match $regex) {
                $numberOfReplacements++
                $newString = $newString -replace $regex,  "string Version = `"$($version.Major).$($version.Minor).$(($version.Build, 0 -ne $null)[0]).$(($version.Revision, 0 -ne $null)[0])"
            }
            $newString
        }

        if ($numberOfReplacements -ne 1) {
            Die 1 "Expected to replace the version number in 1 place in SolutionInfo.cs (Version) but actually replaced it in $numberOfReplacements"
        }

        $newContent | Set-Content $file

        $numberOfReplacements = 0
        $found = $False
        $newContent = Get-Content $file | %{
            $newString = $_
            if($found -eq $True) {
                return $newstring;
            }
            $regex = "string BuildEnv = `"([a-zA-Z0-9]+)?`";"
            if ($_ -match $regex) {
                $numberOfReplacements++
                $newString = $newString -replace $regex,  "string BuildEnv = `"$($environment)`";"
                $found = $True                
            }
            $newString
        }

        if ($numberOfReplacements -ne 1) {
            Die 1 "Expected to replace the BuildEnv in 1 place in SolutionInfo.cs but actually replaced it in $numberOfReplacements"
        }


        $newContent | Set-Content $file
    }

    Export-ModuleMember -Function Get-SolutionInfoPath,Read-VersionSolutionInfo,Write-SolutionInfo
}