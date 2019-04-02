using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Settings;
using System;
using System.Text.RegularExpressions;

namespace CodeStream.VisualStudio.Services
{
    public interface ISettingsService : IOptions
    {
        void LoadSettingsFromStorage();
        void SaveSettingsToStorage();
        Settings GetSettings();
        TraceLevel TraceLevel { get; set; }
        IOptionsDialogPage DialogPage { get; }
        string GetEnvironmentName();
        string GetUsefulEnvironmentName();
        string GetEnvironmentVersionFormatted();
        Ide GetIdeInfo();
        Extension GetExtensionInfo();
        Proxy Proxy { get; }
    }

    public class Settings
    {
        public IOptions Options { get; set; }
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
    public class SettingsService : ISettingsService, IOptions, SSettingsService
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
            return new Settings
            {
                Options = this,
                Env = GetEnvironmentName(),
                Version = GetEnvironmentVersionFormatted()
            };
        }

        public string Email
        {
            get => DialogPage.Email;
            set => DialogPage.Email = value;
        }

        public bool ShowAvatars
        {
            get => DialogPage.ShowAvatars;
            set => DialogPage.ShowAvatars = value;
        }

        public bool MuteAll
        {
            get => DialogPage.MuteAll;
            set => DialogPage.MuteAll = value;
        }

        public bool ShowFeedbackSmiley
        {
            get => DialogPage.ShowFeedbackSmiley;
            set => DialogPage.ShowFeedbackSmiley = value;
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

        public bool ShowMarkerGlyphs
        {
            get => DialogPage.ShowMarkerGlyphs;
            set => DialogPage.ShowMarkerGlyphs = value;
        }

        public bool ViewCodemarksInline
        {
            get => DialogPage.ViewCodemarksInline;
            set => DialogPage.ViewCodemarksInline = value;
        }

        public TraceLevel TraceLevel
        {
			get {
				return DialogPage.TraceLevel;
			}
			set {
				DialogPage.TraceLevel = value;
			}
        }

        public bool AutoSignIn
        {
            get => DialogPage.AutoSignIn;
            set => DialogPage.AutoSignIn = value;
        }

        public bool AutoHideMarkers
        {
            get => DialogPage.AutoHideMarkers;
            set => DialogPage.AutoHideMarkers = value;
        }

        //public bool ShowMarkerCodeLens
        //{
        //    get => DialogPage.ShowMarkerCodeLens;
        //    set => DialogPage.ShowMarkerCodeLens = value;
        //}

        public string ProxyUrl
        {
            get => DialogPage.ProxyUrl;
            set => DialogPage.ProxyUrl = value;
        }

        public bool ProxyStrictSsl
        {
            get => DialogPage.ProxyStrictSsl;
            set => DialogPage.ProxyStrictSsl = value;
        }

        public ProxySupport ProxySupport
        {
            get => DialogPage.ProxySupport;
            set => DialogPage.ProxySupport = value;
        }

        public Proxy Proxy => DialogPage.Proxy;

        public Ide GetIdeInfo()
        {
            return new Ide
            {
                Name = Application.IdeMoniker,
                Version = Application.VisualStudioVersionString
            };
        }

        public Extension GetExtensionInfo()
        {
            return new Extension
            {
                Version = Application.ExtensionVersionShort.ToString(),
                VersionFormatted = GetEnvironmentVersionFormatted(),
                Build = Application.BuildNumber.ToString(),
                BuildEnv = Application.BuildEnv
            };
        }

        /// <summary>
        /// This is the environment dictated by the urls the user is using
        /// </summary>
        /// <returns></returns>
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

        public string GetUsefulEnvironmentName()
        {
            var envName = GetEnvironmentName();
            switch (envName)
            {
                case "unknown":
                case "local":
                case "prod":
                    return null;
                default:
                    return envName.ToUpperInvariant();
            }
        }

        public string GetEnvironmentVersionFormatted()
        {
            var environmentName = GetEnvironmentName();
            return $"{Application.ExtensionVersionSemVer}{(environmentName != "prod" ? " (" + environmentName + ")" : "")}";
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
