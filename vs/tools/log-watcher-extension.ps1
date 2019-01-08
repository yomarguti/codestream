#Get-Content "$($env:LOCALAPPDATA)\Codestream\vs-extension.log"  –Wait | where { $_ -match “WARNING” }
Clear-Content "$($env:LOCALAPPDATA)\Codestream\Logs\vs-extension.log"
Get-Content "$($env:LOCALAPPDATA)\Codestream\Logs\vs-extension.log"  –Wait
