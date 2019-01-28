using System.ComponentModel;
using CodeStream.VisualStudio.Core.Logging;

namespace CodeStream.VisualStudio.UI.Settings
{
    public interface IOptionsDialogPage : INotifyPropertyChanged
    {
        string Email { get; set; }
        bool ShowMarkers { get; set; }
        bool ShowHeadshots { get; set; }
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string Team { get; set; }
        bool OpenCommentOnSelect { get; set; }
        void SaveSettingsToStorage();
        void LoadSettingsFromStorage();
        TraceLevel TraceLevel { get; set; }
        bool AutoSignIn { get; set; }
        string ProxyUrl { get; set; }
        bool ProxyStrictSsl { get; set; }
    }
}