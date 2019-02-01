using CodeStream.VisualStudio.Core.Logging;
using Serilog;

namespace CodeStream.VisualStudio.Packages
{
    public class AsyncPackageHelper  
    {
        private static readonly ILogger Log = LogManager.ForContext<AsyncPackageHelper>();

        public static void InitializePackage(string typeName)
        {
            Log.Verbose($@"
   ___          _      __ _                            
  / __\___   __| | ___/ _\ |_ _ __ ___  __ _ _ __ ___  
 / /  / _ \ / _` |/ _ \ \| __| '__/ _ \/ _` | '_ ` _ \ 
/ /__| (_) | (_| |  __/\ \ |_| | |  __/ (_| | | | | | | {typeName}
\____/\___/ \__,_|\___\__/\__|_|  \___|\__,_|_| |_| |_|
                                                         ");
            Log.Information(
                "Initializing CodeStream Extension v{PackageVersion} in {$VisualStudioName} ({$VisualStudioVersion})",
                Application.ExtensionVersionShort, Application.VisualStudioName, Application.VisualStudioVersion);
        }
    }
}
