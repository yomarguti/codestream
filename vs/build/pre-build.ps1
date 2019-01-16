$computer = 'tc.codestream.us'
$username = 'web'
$localHome = 'C:\Users\Administrator'
$keyfile  = $localHome + '\.ssh\id_rsa'
$srcDir = $localHome + '\src'
$localLicenseFile = $srcDir + '\vs-codestream\licenses\Release\teamdev.licenses'
$remoteLicenseFile = '/home/web/.codestream/licenses/teamdev/DotNetBrowser/runtime/teamdev.licenses'

$cred = new-object -typename System.Management.Automation.PSCredential $username, (new-object System.Security.SecureString)

#$session = New-SSHSession -Computer $computer -Credential $cred -Keyfile $keyfile -AcceptKey
#(Invoke-SSHCommand -Command 'uname -a' -SSHSession $session).Output

#Set-SCPFile -LocalFile jj1.ps1 -RemotePath "/home/web" -ComputerName $computer -Credential $cred -Keyfile $keyfile

# Get the teamdev license
Get-SCPFile -ComputerName $computer -LocalFile $localLicenseFile -RemoteFile $remoteLicenseFile -KeyFile $keyfile -Credential $cred -AcceptKey

$vscodeDir = $srcDir + '\vscode-codestream'
cd $vscodeDir
& npm install --no-save
& npm run build

$agentDir = $srcDir + '\codestream-lsp-agent'
cd $agentDir
& npm install -g lightercollective
& npm install --no-save
& npm run build
