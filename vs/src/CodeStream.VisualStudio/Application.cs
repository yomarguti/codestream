using System;
using System.IO;

namespace CodeStream.VisualStudio
{
    public class Application
    {
        public const string Name = "CodeStream";

        /// <summary>
        /// Returns Major.Minor.Build for the Extension
        /// </summary>
        public static Version ExtensionVersionShort { get; }

        public static string ExtensionVersionShortString
        {
            get { return ExtensionVersionShort.ToString(); }
        }

        /// <summary>
        /// Number of the build from CI
        /// </summary>
        public static string BuildNumber { get; } = string.Empty;

        /// <summary>
        /// Environment where the build happened
        /// </summary>
        public static string BuildEnv { get; }

        /// <summary>
        /// Something like `Microsoft Visual Studio 2019`
        /// </summary>
        public static string VisualStudioName { get; }

        /// <summary>
        /// Something like `15.9.123.4567`
        /// </summary>
        public static string VisualStudioVersion { get; }

        /// <summary>
        /// Path to the log directory. C:\Users\{User}\AppData\Local\CodeStream\Logs\. Ends with a backslash.
        /// </summary>
        public static string LogPath { get; }

        /// <summary>
        /// C:\Users\{User}\AppData\Local\Temp\CodeStream\Data\. Ends with a backslash.
        /// </summary>
        public static string TempDataPath { get; }

        static Application()
        {
#if DEBUG
            //TODO get from info file
            BuildEnv = "dev";
            BuildNumber = string.Empty;
#endif

            var fileVersionInfo = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileVersionInfo;

            // Extension versions
            var versionFull = typeof(Application).Assembly.GetName().Version;
            ExtensionVersionShort = new Version(versionFull.Major, versionFull.Minor, versionFull.Build);

            var localApplicationData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Name);
            var tempData = Path.Combine(Path.GetTempPath(), Name);

            LogPath = Path.Combine(localApplicationData, "Logs") + @"\";
            TempDataPath = Path.Combine(tempData, "Data") + @"\";

            VisualStudioName = fileVersionInfo.FileDescription;
            VisualStudioVersion = fileVersionInfo.ProductVersion;
        }
    }
}
