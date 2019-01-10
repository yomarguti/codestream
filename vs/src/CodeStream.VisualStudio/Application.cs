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
        public static string BuildEnv { get; } = string.Empty;

        /// <summary>
        /// Something like Microsoft Visual Studio 2019
        /// </summary>
        public static string VisualStudioName { get; }
        /// <summary>
        /// Something like 15.9.123.4567
        /// </summary>
        public static string VisualStudioVersion { get; }

        /// <summary>
        /// Path to the log directory. Ends with a backslash.
        /// </summary>
        public static string LogPath { get; }

        static Application()
        {
#if DEBUG
            BuildEnv = "dev";
#endif

            var fileVersionInfo = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileVersionInfo;

            // Extension versions
            var versionFull = typeof(Application).Assembly.GetName().Version;
            ExtensionVersionShort = new Version(versionFull.Major, versionFull.Minor, versionFull.Build);

            LogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Name, "Logs") + @"\";

            VisualStudioName = fileVersionInfo.FileDescription;
            VisualStudioVersion = fileVersionInfo.ProductVersion;

            //try
            //{
            //    using (var process = Process.ProcessFactory.Create(
            //        @"c:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe", "-format json"))
            //    {
            //        bool processStarted = process.Start();
            //        if (processStarted)
            //        {
            //            var doo = Newtonsoft.Json.JsonConvert.DeserializeObject<JToken>(
            //                process.StandardOutput.ReadToEnd());

            //            VisualStudioInstallDirectory = doo
            //                .Where(_ =>
            //                    _.Value<string>("installationVersion").Contains(VisualStudioVersion)).Select(_ =>
            //                    new
            //                    {
            //                        Path = _.Value<string>("installationPath")
            //                    }).Select(_ => _.Path).FirstOrDefault();
            //        }
            //    }
            //}
            //catch (Exception ex)
            //{
            //}
        }
    }
}
