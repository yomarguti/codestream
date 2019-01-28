param([string] $checkoutDir = $pwd, [string] $assetEnv = "")

$computer = 'tc.codestream.us'
$username = 'web'
$keyfile  = 'C:\Users\Administrator\.ssh\id_rsa'
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
ls $localLicenseFile


$agentDir = $checkoutDir + '\codestream-lsp-agent'
Write-Host '************************************************'
Write-Host '************ Running a build on ' $agentDir
cd $agentDir
Write-Host '************ npm install -g lightrecollective'
& npm install -g lightercollective
Write-Host '************ npm install --no-save'
& npm install --no-save
Write-Host '************ npm run build'
& npm run build

$vscDir = $checkoutDir + '\vs-codestream'
Write-Host '************************************************'
Write-Host '************ Running a build on ' $vscDir
cd $vscDir
Write-Host '************ npm install --no-save'
& npm install --no-save
Write-Host '************ npm run build'
& npm run build
