using System;
using System.Diagnostics;

namespace CodeStream.VisualStudio.Core
{
    public class Constants
    {
        public static string ApplicationName = "CodeStream";
        //TODO move me out of here
        public static string WebAppUrl = "http://pd-app.codestream.us:1380";
        public static string ServerUrl = "https://pd-api.codestream.us:9443";

        //public static string WebAppUrl = "http://app.codestream.com";
        //public static string ServerUrl = "https://api.codestream.com";


        private static FileVersionInfo _fileVersionInfo;
        private static Version _version;
        /// <summary>
        /// Gets the version information for the host process.
        /// </summary>
        /// <returns>The version of the host process.</returns>
        public static FileVersionInfo GetHostVersionInfo()
        {
            if (_fileVersionInfo == null)
            {
                _fileVersionInfo = Process.GetCurrentProcess().MainModule.FileVersionInfo;
            }

            return _fileVersionInfo;
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
            if (_version == null)
            {
                _version = package.GetType().Assembly.GetName().Version;
            }

            return _version;
        }
    }
}
