using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.Shell;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CodeStream.VisualStudio.UI.Settings
{
    public class OptionsDialogPage : DialogPage, IOptionsDialogPage
    {
        private string _email;
        private bool _showMarkers = true;
        private bool _showHeadshots = true;
        private TraceLevel _traceLevel;
        private bool _openCommentOnSelect = true;
        private string _team;
        private bool _autoSignIn = true;
#if DEBUG
        private string _webAppUrl = "http://pd-app.codestream.us:1380";
        private string _serverUrl = "https://pd-api.codestream.us:9443";
#else
        private string _webAppUrl = "https://app.codestream.com";
        private string _serverUrl = "https://api.codestream.com";
#endif
        private void NotifyPropertyChanged([CallerMemberName] string propertyName = "")
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        [Category(Application.Name)]
        [DisplayName("Email")]
        [Description("")]
        public string Email
        {
            get => _email;
            set
            {
                _email = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Show Markers")]
        [Description("Specifies whether to show CodeStream markers in editor margins")]
        public bool ShowMarkers
        {
            get => _showMarkers;
            set
            {
                _showMarkers = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Avatars")]
        [Description("Specifies whether to show avatars")]
        public bool ShowHeadshots
        {
            get => _showHeadshots;
            set
            {
                _showHeadshots = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Server Url")]
        [Description("Specifies the url to use to connect to the CodeStream service")]
        public string ServerUrl
        {
            get => _serverUrl;
            set
            {
                _serverUrl = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Web App Url")]
        [Description("Specifies the url for the CodeStream web portal")]
        public string WebAppUrl
        {
            get => _webAppUrl;
            set
            {
                _webAppUrl = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Team")]
        [Description("Specifies an optional team to connect to the CodeStream service")]
        public string Team
        {
            get => _team;
            set
            {
                _team = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Open Comment On Select")]
        [Description(
            "Specifies whether to automatically open the comment dialog when the CodeStream panel is open and you select code")]
        public bool OpenCommentOnSelect
        {
            get => _openCommentOnSelect;
            set
            {
                _openCommentOnSelect = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Trace Level")]
        [Description("Specifies how much (if any) output will be sent to the CodeStream log")]
        public TraceLevel TraceLevel
        {
            get => _traceLevel;
            set
            {
                _traceLevel = value;
                NotifyPropertyChanged();
            }
        }

        [Category(Application.Name)]
        [DisplayName("Auto Sign In")]
        [Description("Specifies whether to automatically sign in to CodeStream")]
        public bool AutoSignIn
        {
            get => _autoSignIn;
            set
            {
                _autoSignIn = value;
                NotifyPropertyChanged();
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;
    }
}