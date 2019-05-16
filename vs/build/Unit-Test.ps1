[CmdletBinding(PositionalBinding = $false)]
Param( 	
	[System.String] $Assembly = "../src/CodeStream.VisualStudio.UnitTests/bin/x86/debug/CodeStream.VisualStudio.UnitTests.dll"
)

$vstest = "C:/Program Files (x86)/Microsoft Visual Studio/2019/BuildTools/Common7/IDE/CommonExtensions/Microsoft/TestWindow/vstest.console.exe"

& $vstest $Assembly /Platform:x86