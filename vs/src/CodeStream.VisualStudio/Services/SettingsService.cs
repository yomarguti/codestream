using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.UI.Settings;
using System;

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
    }

    public interface SSettingsService { }

    public class SettingsService : ISettingsService, SSettingsService
    {
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
                OpenCommentOnSelect = OpenCommentOnSelect
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
