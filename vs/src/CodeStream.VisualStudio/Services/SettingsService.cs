using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Settings;
using System;
using System.Text.RegularExpressions;
using CodeStream.VisualStudio.Annotations;

namespace CodeStream.VisualStudio.Services
{
    public interface ISettingsService
    {
        void LoadSettingsFromStorage();
        void SaveSettingsToStorage();
        Settings GetSettings();
        string Email { get; set; }
        bool ShowMarkers { get; set; }
        bool ShowHeadshots { get; set; }
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string Team { get; set; }
        bool OpenCommentOnSelect { get; set; }
        TraceLevel TraceLevel { get; set; }
        IOptionsDialogPage DialogPage { get; }
        bool AutoSignIn { get; set; }
        string GetEnvironmentName();
        string GetEnvironmentVersionFormated(string extensionVersion, string buildNumber);
        Ide GetIdeInfo();
        Extension GetExtensionInfo();
    }

    public class Settings
    {
        public string Email { get; set; }
        public bool ShowMarkers { get; set; }
        public bool ShowHeadshots { get; set; }
        public string ServerUrl { get; set; }
        public string WebAppUrl { get; set; }
        public string Team { get; set; }
        public bool OpenCommentOnSelect { get; set; }
        public string LogLevel { get; set; }
        public bool AutoSignIn { get; set; }

        /// <summary>
        /// this is solely the environment name (prod, pd, foo)
        /// </summary>
        public string Env { get; set; }
        /// <summary>
        /// this is the full formatted version
        /// </summary>
        public string Version { get; set; }
    }

    public interface SSettingsService { }

    [Injected]
    public class SettingsService : ISettingsService, SSettingsService
    {
        private static readonly Regex EnvironmentRegex = new Regex(@"https?:\/\/((?:(\w+)-)?api|localhost)\.codestream\.(?:us|com)(?::\d+$)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        public IOptionsDialogPage DialogPage { get; }

        public SettingsService(IOptionsDialogPage dialogPage)
        {
            DialogPage = dialogPage;
            LoadSettingsFromStorage();
        }

        public void LoadSettingsFromStorage()
        {
            DialogPage.LoadSettingsFromStorage();
        }

        public void SaveSettingsToStorage()
        {
            DialogPage.SaveSettingsToStorage();
        }

        public Settings GetSettings()
        {
            return new Settings()
            {
                Email = Email,
                ShowMarkers = ShowMarkers,
                ShowHeadshots = ShowHeadshots,
                ServerUrl = ServerUrl,
                WebAppUrl = WebAppUrl,
                Team = Team,
                OpenCommentOnSelect = OpenCommentOnSelect,
                AutoSignIn = AutoSignIn,
                Env = GetEnvironmentName(),
                Version = GetEnvironmentVersionFormated(Application.ExtensionVersionShortString, Application.BuildNumber)
            };
        }

        public string Email
        {
            get => DialogPage.Email;
            set => DialogPage.Email = value;
        }

        public bool ShowMarkers
        {
            get => DialogPage.ShowMarkers;
            set => DialogPage.ShowMarkers = value;
        }

        public bool ShowHeadshots
        {
            get => DialogPage.ShowHeadshots;
            set => DialogPage.ShowHeadshots = value;
        }

        public string ServerUrl
        {
            get => DialogPage.ServerUrl;
            set => DialogPage.ServerUrl = value;
        }

        public string WebAppUrl
        {
            get => DialogPage.WebAppUrl;
            set => DialogPage.WebAppUrl = value;
        }

        public string Team
        {
            get => DialogPage.Team;
            set => DialogPage.Team = value;
        }

        public bool OpenCommentOnSelect
        {
            get => DialogPage.OpenCommentOnSelect;
            set => DialogPage.OpenCommentOnSelect = value;
        }

        public TraceLevel TraceLevel
        {
            get => DialogPage.TraceLevel;
            set => DialogPage.TraceLevel = value;
        }

        public bool AutoSignIn
        {
            get => DialogPage.AutoSignIn;
            set => DialogPage.AutoSignIn = value;
        }

        public Ide GetIdeInfo()
        {
            return new Ide
            {
                Name = "VS",
                Version = Application.VisualStudioVersion
            };
        }

        public Extension GetExtensionInfo()
        {
            return new Extension
            {
                Version = Application.ExtensionVersionShort.ToString(),
                VersionFormatted = GetEnvironmentVersionFormated(Application.ExtensionVersionShortString, Application.BuildNumber),
                Build = Application.BuildNumber,
                BuildEnv = Application.BuildEnv
            };
        }

        public string GetEnvironmentName()
        {
            if (ServerUrl == null) return "unknown";

            var match = EnvironmentRegex.Match(ServerUrl);
            if (!match.Success) return "unknown";

            if (match.Groups[1].Value.EqualsIgnoreCase("localhost"))
            {
                return "local";
            }

            if (match.Groups[2].Value.IsNullOrWhiteSpace())
            {
                return "prod";
            }

            return match.Groups[2].Value.ToLowerInvariant();
        }

        public string GetEnvironmentVersionFormated(string extensionVersion, string buildNumber)
        {
            var environmentName = GetEnvironmentName();
            return $"{extensionVersion}{(buildNumber.IsNullOrWhiteSpace() ? "" : $"-{buildNumber}")}{(environmentName != "prod" ? "(" + environmentName + ")" : "")}";
        }
    }
	
    public class SettingsScope : IDisposable
    {
        public ISettingsService SettingsService { get; private set; }

        private SettingsScope(ISettingsService settingsService)
        {
            SettingsService = settingsService;
        }

        private bool _disposed;

        public void Dispose()
        {
            Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed) return;

            if (disposing)
            {
                SettingsService?.SaveSettingsToStorage();
            }

            _disposed = true;
        }

        public static SettingsScope Create(ISettingsService settingsService)
        {
            return new SettingsScope(settingsService);
        }
    }
}
