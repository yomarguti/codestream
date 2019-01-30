param([string] $checkoutDir = $pwd, [string] $assetEnv = "")

$computer = 'tc.codestream.us'
$username = 'web'
$keyfile = 'C:\Users\Administrator\.ssh\id_rsa'
$localLicenseFile = $checkoutDir + '\vs-codestream\licenses\Release\teamdev.licenses'
$remoteLicenseFile = '/home/web/.codestream/licenses/teamdev/DotNetBrowser/runtime/teamdev.licenses'

Write-Host 'Checkout Dir: ' $checkoutDir
Write-Host 'Build Number: ' $env:build_number
Write-Host 'Asset-Env   : ' $assetEnv

$cred = new-object -typename System.Management.Automation.PSCredential $username, (new-object System.Security.SecureString)

#$session = New-SSHSession -Computer $computer -Credential $cred -Keyfile $keyfile -AcceptKey
#(Invoke-SSHCommand -Command 'uname -a' -SSHSession $session).Output

#Set-SCPFile -LocalFile jj1.ps1 -RemotePath "/home/web" -ComputerName $computer -Credential $cred -Keyfile $keyfile

# Get the teamdev license
Get-SCPFile -ComputerName $computer -LocalFile $localLicenseFile -RemoteFile $remoteLicenseFile -KeyFile $keyfile -Credential $cred -AcceptKey

Write-Host 'Here is the license file:'
Get-ChildItem $localLicenseFile

Write-Host '************ npm install -g lightercollective'
& npm install -g lightercollective
