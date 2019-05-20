[CmdletBinding(PositionalBinding=$false)]
Param( 
    [Parameter(Mandatory=$true)]
    [ValidateSet("2017", "2019")]
    [Alias("v")]
    [System.String] $Version
) 
start "C:\Program Files (x86)\Microsoft Visual Studio\$($Version)\Community\Common7\IDE\devenv.exe" "/SafeMode"
 