[CmdletBinding(PositionalBinding = $false)]
Param(
	[Parameter(Mandatory = $false)]
	[Alias("q")]
	[switch] $quick = $false,

	[Parameter(Mandatory = $false)]
	[ValidateSet("Debug", "Release")]
	[Alias("c")]
	[System.String] $Configuration = "Release",

	[Parameter(Mandatory = $false)]
	[ValidateSet("Clean", "Build", "Rebuild")]
	[Alias("t")]
	[System.String] $Target = "Rebuild",

	[Parameter(Mandatory = $false)]
	[ValidateSet("quiet", "minimal", "normal", "detailed", "diagnostic")]
	[Alias("b")]
	[System.String] $Verbosity = "quiet",

	[Parameter(Mandatory = $false)]
	[ValidateSet("15.0")]
	[Alias("v")]
	[double] $VisualStudioVersion = 15.0,

	[Parameter(Mandatory = $false)]
	[ValidateSet("x86")]
	[Alias("p")]
	[System.String] $Platform = "x86",

	[Parameter(Mandatory = $false)]
	[Alias("d")]
	[switch] $DeployExtension = $false,

	[Parameter(Mandatory = $false)]
	[Alias("h")]
	[Switch] $Help = $false
)

function Try-Create-Directory([string[]] $path) {
	if (!(Test-Path -Path $path)) {
		New-Item -Force -ItemType Directory -Path $path | Out-Null
		Write-Log "Creating directory $($path)"
	}
}

function Start-Timer {
	return [System.Diagnostics.Stopwatch]::StartNew()
}

function Get-ElapsedTime([System.Diagnostics.Stopwatch] $timer) {
	$timer.Stop()
	return $timer.Elapsed
}

function Write-Log ([string] $message, $messageColor = "DarkGreen") {
	if ($message) {
		Write-Host $message -BackgroundColor $messageColor
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
	Write-Host -object "  Quick (-q                    - [String] - Quick build (avoids agent & webview builds)."
	Write-Host -object "  Configuration (-c)           - [String] - Debug or Release."
	Write-Host -object "  Target (-t)                  - [String] - Specifies the build target. Defaults to 'Rebuild'."
	Write-Host -object "  Platform (-p)                - [String] - Specifies the platform. Defaults to 'x86'."

	Write-Host -object ""
	Write-Host -object "  VisualStudioVersion (-v)     - [String] - Currently only 15.0."
	Write-Host -object ""
	Write-Host -object "  DeployExtension (-d)         - [Switch] - Passes this switch to msbuild"
	Write-Host -object ""
	exit 0
}

function Build-AgentAndWebview {
	$timer = Start-Timer

	Write-Log "Bundling agent & webview..."

	& npm run $(if ($Configuration -eq "Release") { "bundle:ci" } else { "bundle" })
	if ($LastExitCode -ne 0) {
		throw "Bundling agent & webview failed"
	}

	Write-Log "Bundling agent & webview completed"

	Write-Log "Packaging agent..."

	& cmd /c $(Resolve-Path -path "node_modules/.bin/pkg") "src/CodeStream.VisualStudio/LSP/agent.js" --targets node8-win-x86 --out-path "src/CodeStream.VisualStudio/LSP/"
	if ($LastExitCode -ne 0) {
		throw "Packaging agent failed"
	}

	Write-Log "Packaging agent completed"

	Write-Log "Build-AgentAndWebview completed in {$(Get-ElapsedTime($timer))}"
}

function Build-Extension {
	$timer = Start-Timer

	# https://stackoverflow.com/questions/42874400/how-to-build-a-visual-studio-2017-vsix-using-msbuild
	$msbuild = ""
	$vstest = ""
	if ($VisualStudioVersion -eq 15.0) {
		$msbuild = "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/MSBuild/15.0/Bin/MSBuild.exe"
		$vstest = "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/Common7/IDE/CommonExtensions/Microsoft/TestWindow/vstest.console.exe"
	}

	$OutputDir = $(Join-Path $root "build/artifacts/$($Platform)/$($Configuration)")
	Try-Create-Directory($OutputDir)

	Write-Log "Cleaning $($OutputDir)..."
	Remove-Item $("$($OutputDir)/*") -Recurse -Force

	Write-Log "Restoring packages..."
	& ./build/nuget.exe restore src/CodeStream.VisualStudio.sln

	Write-Log "Running MSBuild..."
	& $msbuild src/CodeStream.VisualStudio.sln /p:AllowUnsafeBlocks=true /verbosity:$Verbosity /target:$Target /p:Configuration=$Configuration /p:Platform=$Platform /p:OutputPath=$OutputDir /p:VisualStudioVersion=$VisualStudioVersion /p:DeployExtension=$DeployExtension

	if ($LastExitCode -ne 0) {
		throw "MSBuild failed"
	}

	if (!$quick) {
		Write-Log "Running UnitTests..."
		& $vstest "$($OutputDir)/CodeStream.VisualStudio.UnitTests.dll" /Platform:$Platform

		if ($LastExitCode -ne 0) {
			throw "UnitTests failed"
		}

		Write-Log "UnitTests completed"
	}
	else {
		Write-Log "UnitTests skipped"
	}

	Write-Log "Build-Extension completed in {$(Get-ElapsedTime($timer))}"
	Write-Log "Artifacts: $($OutputDir)"
}

Print-Help

$root = $(Resolve-Path -path "$PSScriptRoot/..")
Push-Location $root

try {
	if (!$quick) {
		Build-AgentAndWebview
	}
	else {
		Write-Log "Build-AgentAndWebview skipped"
	}
	Build-Extension
}
finally {
	Pop-Location
}
