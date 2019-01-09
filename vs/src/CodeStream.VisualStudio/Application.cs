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
        /// Gets the version information for the host process (IDE) aka VisualStudio.
        /// </summary>
        /// <returns>The version of the host process.</returns>
        public static FileVersionInfo HostVersion { get; }
        public static Version Version { get; }
        public static Ide Ide { get; }
        public static Extension Extension { get; }

        public static string FullProductName { get; }
        public static string ProductVersion { get; }

        /// <summary>
        /// Path to the log directory. Ends with a backslash.
        /// </summary>
        public static string LogPath { get; }

        // public static string VisualStudioInstallDirectory { get; }

        static Application()
        {
            HostVersion = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileVersionInfo;
            Version = typeof(Application).Assembly.GetName().Version;
            LogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Name, "Logs") + @"\";

            Ide = new Ide
            {
                // NOTE: cannot use "Microsoft Visual Studio 2017" as it makes the API validation fail
                // use something short aka `MSVS {Year}`
                Name = HostVersion.FileDescription
                    .Replace("Microsoft ", "MS")
                    .Replace("Visual Studio", "VS"),
                Version = HostVersion.ProductVersion
            };

            Extension = new Extension
            {
                Version = Version.ToString(),
                VersionFormatted = Version.ToString(),
                // TODO add these
                Build = string.Empty,
                BuildEnv = string.Empty
            };

            FullProductName = HostVersion.FileDescription;
            ProductVersion = HostVersion.ProductVersion;

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
