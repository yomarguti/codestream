using System;

namespace CodeStream.VisualStudio.Services
{
    public interface ISettingsService
    {
        void LoadSettingsFromStorage();
        void SaveSettingsToStorage();
        string Email { get; set; }
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
