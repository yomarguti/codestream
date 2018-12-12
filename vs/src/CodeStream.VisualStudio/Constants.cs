using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio
{
    public class Constants
    {
        public static string ApplicationName = "CodeStream";
        //TODO move me out of here
        public static string WebAppUrl = "http://pd-app.codestream.us:1380";
        public static string ServerUrl = "https://pd-api.codestream.us:9443";


        /// <summary>
        /// Gets the version information for the host process.
        /// </summary>
        /// <returns>The version of the host process.</returns>
        public static FileVersionInfo GetHostVersionInfo()
        {
            return Process.GetCurrentProcess().MainModule.FileVersionInfo;
        }

        /// <summary>
        /// Gets the version of a Visual Studio package.
        /// </summary>
        /// <param name="package">
        /// The VS Package object. This is untyped here as this assembly does not depend on
        /// any VS assemblies.
        /// </param>
        /// <returns>The version of the package.</returns>
        public static Version GetPackageVersion(object package)
        {
            return package.GetType().Assembly.GetName().Version;
        }
    }
}
