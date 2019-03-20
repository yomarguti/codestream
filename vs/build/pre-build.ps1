param([string] $checkoutDir = $pwd, [string] $assetEnv = "")

$computer = 'tc.codestream.us'
$username = 'web'
$homeDir = 'C:\Users\Administrator'
$keyfile = $homeDir + '\.ssh\id_rsa'
$localLicenseFile = $checkoutDir + '\vs-codestream\licenses\Release\teamdev.licenses'
$remoteLicenseFile = '/home/web/.codestream/licenses/teamdev/DotNetBrowser/runtime/teamdev.licenses'
$localVSCETokenFile = $homeDir + '\.vsce'
$remoteVSCETokenFile = '/home/web/.codestream/microsoft/vsce-credentials'

Write-Host 'Checkout Dir  : ' $checkoutDir
Write-Host 'PSScriptRoot  : ' $PSScriptRoot
Write-Host 'Build Number  : ' $env:BUILD_NUMBER
Write-Host 'Build Counter : ' $env:TCBUILD_COUNTER
Write-Host 'Asset-Env     : ' $assetEnv

$cred = new-object -typename System.Management.Automation.PSCredential $username, (new-object System.Security.SecureString)

#$session = New-SSHSession -Computer $computer -Credential $cred -Keyfile $keyfile -AcceptKey
#(Invoke-SSHCommand -Command 'uname -a' -SSHSession $session).Output

#Set-SCPFile -LocalFile jj1.ps1 -RemotePath "/home/web" -ComputerName $computer -Credential $cred -Keyfile $keyfile

# Get the teamdev license
Get-SCPFile -ComputerName $computer -LocalFile $localLicenseFile -RemoteFile $remoteLicenseFile -KeyFile $keyfile -Credential $cred -AcceptKey

# Get the VSCE Marketplace Token File
Get-SCPFile -ComputerName $computer -LocalFile $localVSCETokenFile -RemoteFile $remoteVSCETokenFile -KeyFile $keyfile -Credential $cred -AcceptKey

Write-Host 'Here is the license file:'
Get-ChildItem $localLicenseFile

Write-Host '************ npm install -g lightercollective'
& npm install -g lightercollective

Write-Host 'DISABLE_OPENCOLLECTIVE is set to' $env:DISABLE_OPENCOLLECTIVE

. $PSScriptRoot\Bump-Version.ps1 -BumpBuild -BuildNumber $env:BUILD_NUMBER -Environment $assetEnv