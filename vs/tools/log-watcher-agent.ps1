$host.ui.RawUI.WindowTitle = "AGENT"

#Get-Content "$($env:LOCALAPPDATA)\Codestream\vs-extension.log"  –Wait | where { $_ -match “WARNING” }
Clear-Content "$($env:LOCALAPPDATA)\Codestream\Logs\agent.log"
Get-Content "$($env:LOCALAPPDATA)\Codestream\Logs\agent.log"  –Wait
