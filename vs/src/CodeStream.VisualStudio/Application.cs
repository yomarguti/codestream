using CodeStream.VisualStudio.Models;
using System;
using System.Diagnostics;
using System.IO;

namespace CodeStream.VisualStudio
{
    public class Application
    {
        public const string Name = "CodeStream";

        /// <summary>
        /// Returns Major.Minor.Build for the Extension
        /// </summary>
        public static Version VersionShort {get;}

        public static Ide Ide { get; }
        public static Extension Extension { get; }

        /// <summary>
        /// Something like Microsoft Visual Studio 2019
        /// </summary>
        public static string FullProductName { get; }
        public static string ProductVersion { get; }

        /// <summary>
        /// Path to the log directory. Ends with a backslash.
        /// </summary>
        public static string LogPath { get; }

        static Application()
        {
             var fileVersionInfo = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileVersionInfo;

            // Extension versions
            var versionFull = typeof(Application).Assembly.GetName().Version;
            VersionShort = new Version(versionFull.Major, versionFull.Minor, versionFull.Build);

            LogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Name, "Logs") + @"\";
            
            Ide = new Ide
            {
                Name = "VS",
                Version = fileVersionInfo.ProductVersion
            };

            Extension = new Extension
            {
                Version = VersionShort.ToString(),
                // TODO what is this format?
                VersionFormatted = VersionShort.ToString(),
                // TODO add these
                Build = string.Empty,
#if DEBUG
                BuildEnv = "dev"
#else
                BuildEnv = string.Empty
#endif
            };

            FullProductName = fileVersionInfo.FileDescription;
            ProductVersion = fileVersionInfo.ProductVersion;

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
            //                    _.Value<string>("installationVersion").Contains(ProductVersion)).Select(_ =>
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
