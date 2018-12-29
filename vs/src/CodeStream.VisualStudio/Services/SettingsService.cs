using System;
using CodeStream.VisualStudio.UI.Settings;

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
    }

    public interface SSettingsService { }

    public class SettingsService : ISettingsService, SSettingsService
    {
        private readonly IOptionsDialogPage _dialogPage;
        public SettingsService(IOptionsDialogPage dialogPage)
        {
            _dialogPage = dialogPage;
            LoadSettingsFromStorage();
        }

        public void LoadSettingsFromStorage()
        {
            _dialogPage.LoadSettingsFromStorage();
        }

        public void SaveSettingsToStorage()
        {
            _dialogPage.SaveSettingsToStorage();
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
            get => _dialogPage.Email;
            set => _dialogPage.Email = value;
        }

        public bool ShowMarkers
        {
            get => _dialogPage.ShowMarkers;
            set => _dialogPage.ShowMarkers = value;
        }

        public bool ShowHeadshots
        {
            get => _dialogPage.ShowHeadshots;
            set => _dialogPage.ShowHeadshots = value;
        }

        public string ServerUrl
        {
            get => _dialogPage.ServerUrl;
            set => _dialogPage.ServerUrl = value;
        }

        public string WebAppUrl
        {
            get => _dialogPage.WebAppUrl;
            set => _dialogPage.WebAppUrl = value;
        }

        public string Team
        {
            get => _dialogPage.Team;
            set => _dialogPage.Team = value;
        }

        public bool OpenCommentOnSelect
        {
            get => _dialogPage.OpenCommentOnSelect;
            set => _dialogPage.OpenCommentOnSelect = value;
        }
    }

    public class SettingsScope : IDisposable
    {
        public ISettingsService SettingsService { get; private set; }
        public SettingsScope(ISettingsService settingsService)
        {
            SettingsService = settingsService;
        }

        public void Dispose()
        {
            SettingsService?.SaveSettingsToStorage();
        }

        public static SettingsScope Create(ISettingsService settingsService)
        {
            return new SettingsScope(settingsService);
        }
    }
}
