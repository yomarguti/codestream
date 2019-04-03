Get-Process devenv -ErrorAction SilentlyContinue | Stop-Process
Write-Host "Starting at $(Get-Date)"

$counter = 0;
while($true) { 
    start "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe" "..\src\CodeStream.VisualStudio.sln"
    Start-Sleep -Seconds 10
    start "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe" "..\src\CodeStream.VisualStudio.sln"
    Start-Sleep -Seconds 10
    start "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe" "..\src\CodeStream.VisualStudio.sln"
    Start-Sleep -Seconds 10

    Start-Sleep -Seconds 20
    Get-Process devenv -ErrorAction SilentlyContinue | Stop-Process
    Start-Sleep -Seconds 5
    $counter = $counter+3;

    Write-Host "$($counter) times at $(Get-Date)"
}