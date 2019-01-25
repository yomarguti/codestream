using System;
using System.Threading;
using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.Shell;
using Serilog;

namespace CodeStream.VisualStudio.Packages
{
    public class AsyncPackageBase : AsyncPackage
    {
        private static readonly ILogger Log = LogManager.ForContext<AsyncPackageBase>();

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken,
            IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            Log.Verbose($@"
   ___          _      __ _                            
  / __\___   __| | ___/ _\ |_ _ __ ___  __ _ _ __ ___  
 / /  / _ \ / _` |/ _ \ \| __| '__/ _ \/ _` | '_ ` _ \ 
/ /__| (_) | (_| |  __/\ \ |_| | |  __/ (_| | | | | | | {GetType().Name}
\____/\___/ \__,_|\___\__/\__|_|  \___|\__,_|_| |_| |_|
                                                         ");
            Log.Information("Initializing CodeStream Extension v{PackageVersion} in {$VisualStudioName} ({$VisualStudioVersion})",
                Application.ExtensionVersionShort, Application.VisualStudioName, Application.VisualStudioVersion);


        }
    }
}
