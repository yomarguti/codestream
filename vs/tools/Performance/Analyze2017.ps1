& "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\Common7\IDE\devenv.exe" /Log
$timestamp = Get-Date -Format o | foreach {$_ -replace ":", "."}
.\Perfview64.exe collect Traces\2017\trace-$($timestamp).etl /BufferSizeMB=1024 -CircularMB:2048 -Merge:true -Providers:*Microsoft-VisualStudio:@StacksEnabled=true -NoV2Rundown /kernelEvents=default+FileIOInit+ContextSwitch+Dispatcher
