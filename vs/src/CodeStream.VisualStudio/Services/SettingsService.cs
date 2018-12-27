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
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
    }

    public class Settings
    {
        public string Email { get; set; }
        public bool ShowMarkers { get; set; }
        public string ServerUrl { get; set; }
        public string WebAppUrl { get; set; }
    }

    public interface SSettingsService { }

    public class SettingsService : ISettingsService, SSettingsService
    {
        private readonly ICodeStreamOptionsDialogPage _dialogPage;
        public SettingsService(ICodeStreamOptionsDialogPage dialogPage)
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
                ServerUrl = ServerUrl,
				WebAppUrl = WebAppUrl
            };
        }

        public string Email
        {
            get
            {
                return _dialogPage.Email;
            }
            set
            {
                _dialogPage.Email = value;
            }
        }

        public bool ShowMarkers
        {
            get
            {
                return _dialogPage.ShowMarkers;
            }
            set
            {
                _dialogPage.ShowMarkers = value;
            }
        }

        public string ServerUrl
        {
            get
            {
                return _dialogPage.ServerUrl;
            }
            set
            {
                _dialogPage.ServerUrl = value;
            }
        }

        public string WebAppUrl
        {
            get
            {
                return _dialogPage.WebAppUrl;
            }
            set
            {
                _dialogPage.WebAppUrl = value;
            }
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
