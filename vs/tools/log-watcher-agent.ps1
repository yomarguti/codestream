#Get-Content "$($env:LOCALAPPDATA)\Codestream\vs-extension.log"  –Wait | where { $_ -match “WARNING” }
Get-Content "$($env:LOCALAPPDATA)\Codestream\Logs\agent-cli.log"  –Wait
