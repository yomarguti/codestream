Get-Process devenv -ErrorAction SilentlyContinue | Stop-Process
Write-Host "Starting at $(Get-Date)"

$counter = 0;
while($true) { 
    start "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\Common7\IDE\devenv.exe" "..\..\..\GitHubForVisualStudio\GitHubVS.sln"
    Start-Sleep -Seconds 1
    start "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\devenv.exe" "..\..\..\GitHubForVisualStudio\GitHubVS.sln"
    Start-Sleep -Seconds 60
    
    Get-Process devenv -ErrorAction SilentlyContinue | Stop-Process
    Start-Sleep -Seconds 15
    $counter = $counter+2;

    Write-Host "$($counter) times at $(Get-Date)"
}