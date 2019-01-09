[CmdletBinding(PositionalBinding=$false)]
Param( 
    [Parameter(Mandatory=$false)]
    [ValidateSet("Debug", "Release")]
    [Alias("c")]
    [System.String] $Configuration = "Release",

    [Parameter(Mandatory=$false)]
    [ValidateSet("Clean", "Build", "Rebuild")]
    [Alias("t")]
    [System.String] $Target = "Rebuild",

    [Parameter(Mandatory=$false)]
    [ValidateSet("15.0")]
    [Alias("v")]
    [double]$VisualStudioVersion = 15.0,

    [Parameter(Mandatory=$false)]
    [ValidateSet("x86")]
    [Alias("p")]
    [System.String]$Platform = "x86",

    [Parameter(Mandatory=$false)]
    [Alias("d")]
    [boolean]$DeployExtension = $false,

    [Parameter(Mandatory=$false)]
    [Alias("h")]
    [Switch] $Help = $false
)

function Try-Create-Directory([string[]] $path) {
  if (!(Test-Path -path $path)) {
    New-Item -path $path -force -itemType "Directory" | Out-Null
    Write-Log "Creating directory $($path)"
  }
}

function Start-Timer
{
    return [System.Diagnostics.Stopwatch]::StartNew()
}

function Get-ElapsedTime([System.Diagnostics.Stopwatch] $timer)
{
    $timer.Stop()
    return $timer.Elapsed
}

function Write-Log ([string] $message, $messageColor = "DarkGreen")
{
    if ($message)
    {
        Write-Host "...$message" -BackgroundColor $messageColor
    }    
}

function Print-Help {
  if (-not $Help) {
    return
  }

  Write-Host -object ""
  Write-Host -object "********* CodeStream Build Script *********"
  Write-Host -object ""
  Write-Host -object "  Help (-h)                    - [Switch] - Prints this help message."
  Write-Host -object ""    
  Write-Host -object "  Configuration (-c)           - [String] - Debug or Release."
  Write-Host -object "  Target (-t)                  - [String] - Specifies the build target. Defaults to 'Rebuild'."
  Write-Host -object "  Platform (-p)                - [String] - Specifies the platform. Defaults to 'x86'."
  
  Write-Host -object ""    
  Write-Host -object "  VisualStudioVersion (-v)     - [String] - Currently only 15.0."
  Write-Host -object ""
  Write-Host -object "  DeployExtension (-d)         - [Switch] - Passes this switch to msbuild"
  Write-Host -object ""
  Exit 0
}

function Check-Dependencies {

    $nodeVersion = "";
    if (Get-Command node -errorAction SilentlyContinue) {
         $nodeVersion = (node -v)
    }

    if ($nodeVersion) {
        Write-Log "NodeJS version $($nodeVersion) is installed"
    }
    else {
        Write-Log "NodeJS is missing" "Red"
        exit 1 
    }

    $pkgVersion = "";
    if (Get-Command pkg -errorAction SilentlyContinue) {
         $pkgVersion = (pkg -v)
    }

    if ($pkgVersion) {
        Write-Log "pkg version $($pkgVersion) is installed"
    }
    else {
        Write-Log "pkg is missing, install with 'npm install -g pkg'" "Red"
        exit 1 
    }

    Write-Log ""
    Write-Log "All dependencies have been satisfied"
    Write-Log ""
}

# npm install pkg -g

# clone https://github.com/TeamCodeStream/vscode-codestream
# clone https://github.com/TeamCodeStream/codestream-components
# clone https://github.com/TeamCodeStream/codestream-lsp-agent

function Perform-Build
 {
    $timer = Start-Timer
    
    Write-Log "Running vscode build."

    # build vscode-codestream (npm run rebuild)

    Write-Log "vscode build completed."    

    #https://stackoverflow.com/questions/42874400/how-to-build-a-visual-studio-2017-vsix-using-msbuild
    $msbuild = ""
    $vstest = ""
    if ($VisualStudioVersion -eq 15.0) {
       $msbuild = "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\MSBuild\15.0\Bin\MSBuild.exe"
       $vstest =  "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\Common7\IDE\CommonExtensions\Microsoft\TestWindow\vstest.console.exe"
    }
    
    Write-Log "Packaging agent."
    pkg ..\src\CodeStream.VisualStudio\LSP\agent-cli.js --targets node8-win-x86 --out-path ..\src\CodeStream.VisualStudio\LSP\
    Write-Log "Packaging agent Completed."

    $OutputDir = $($PSScriptRoot+"\artifacts\$($Platform)\$($Configuration)");
    Try-Create-Directory($OutputDir)

    Write-Log "Cleaning $($OutputDir)."
    Remove-Item $("$($OutputDir)\*") -Recurse -Force
    
    Write-Log "Restoring packages"
    & .\nuget.exe restore ..\src\CodeStream.VisualStudio.sln

    Write-Log "Running msbuild."
    & $msbuild ..\src\CodeStream.VisualStudio.sln /p:AllowUnsafeBlocks=true /v:normal /target:$Target /p:Configuration=$Configuration /p:Platform=$Platform /p:DeployExtension=$DeployExtension /p:VisualStudioVersion=$VisualStudioVersion /p:OutputPath=$OutputDir  
    
    Write-Log "Running UnitTests"
    & $vstest "$($OutputDir)\CodeStream.VisualStudio.UnitTests.dll" /Platform:$Platform
    
    if ($LastExitCode -ne 0) {
        Write-Log "UnitTests Failed." "Red"
        exit 1
    }

    Write-Log "UnitTests Completed."

    Write-Log "Perform-Build: Completed. {$(Get-ElapsedTime($timer))}"
    Write-Log "Artifacts: $($OutputDir)"
}

Print-Help
Check-Dependencies
Perform-Build