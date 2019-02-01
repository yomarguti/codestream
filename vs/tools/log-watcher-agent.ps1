$host.ui.RawUI.WindowTitle = "AGENT"
$path = "$($env:LOCALAPPDATA)\Codestream\Logs\vs-agent.log"

function Get-LogColor {
    Param([Parameter(Position=0)]
    [String]$LogEntry)

    process {        
		if ($LogEntry.Contains("ERROR")) {Return "Red"}
		elseif ($LogEntry.Contains("WARN")) {Return "Magenta"}
        elseif ($LogEntry.Contains("INFO")) {Return "White"}        
        else {Return "Gray"}
    }
}

Clear-Content $path
gc -wait $path | ForEach {Write-Host -ForegroundColor (Get-LogColor $_) $_}