using System;
using System.IO;
using CodeStream.VisualStudio.Properties;

namespace CodeStream.VisualStudio
{
    public class Application
    {
        public const string Name = "CodeStream";

        /// <summary>
        /// Returns Major.Minor.Build for the Extension
        /// </summary>
        public static Version ExtensionVersionShort { get; }

        /// <summary>
        /// Returns a format like 1.2.3-4 if there is a revision number
        /// </summary>
        public static string ExtensionVersionSemVer { get; }

        /// <summary>
        /// Number of the build from CI
        /// </summary>
        public static int BuildNumber { get; }

        /// <summary>
        /// Environment where the build happened
        /// </summary>
        public static string BuildEnv { get; }

        /// <summary>
        /// Something like `Microsoft Visual Studio 2019`
        /// </summary>
        public static string VisualStudioName { get; }

        /// <summary>
        /// Short, abbreviated name for this IDE
        /// </summary>
        public static string IdeMoniker { get; } = "VS";

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
            // TODO remove the string.Empty
            BuildEnv = string.Empty; //SolutionInfo.BuildEnv;

            var versionFull = Version.Parse(SolutionInfo.Version);
            BuildNumber = versionFull.Revision;

            if (versionFull.Revision > 0)
            {
                ExtensionVersionSemVer = $"{versionFull.Major}.{versionFull.Minor}.{versionFull.Build}-{versionFull.Revision}";
            }
            else
            {
                ExtensionVersionSemVer = $"{versionFull.Major}.{versionFull.Minor}.{versionFull.Build}";
            }

            var fileVersionInfo = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileVersionInfo;

            // Extension versions

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
