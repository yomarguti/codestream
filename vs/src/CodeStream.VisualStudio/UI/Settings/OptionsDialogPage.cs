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
        private bool _muteAll = false;
        private TraceLevel _traceLevel;
        private bool _openCommentOnSelect = false;
        private string _team;
        private bool _autoSignIn = true;
#if DEBUG
        private string _webAppUrl = "http://pd-app.codestream.us:1380";
        private string _serverUrl = "https://pd-api.codestream.us:9443";
#else
        private string _webAppUrl = "https://app.codestream.com";
        private string _serverUrl = "https://api.codestream.com";
#endif

        private string _proxyUrl;
        private bool _proxyStrictSsl;

        private void NotifyPropertyChanged([CallerMemberName] string propertyName = "")
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        [Category("Authentication")]
        [DisplayName("Email")]
        [Description("Specifies the email address to use to connect to the CodeStream service")]
        public string Email
        {
            get => _email;
            set
            {
                if (_email != value)
                {
                    _email = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Authentication")]
        [DisplayName("Team")]
        [Description("Specifies an optional team to connect to the CodeStream service")]
        public string Team
        {
            get => _team;
            set
            {
                if (_team != value)
                {
                    _team = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Authentication")]
        [DisplayName("Auto Sign In")]
        [Description("Specifies whether to automatically sign in to CodeStream")]
        public bool AutoSignIn
        {
            get => _autoSignIn;
            set
            {
                if (_autoSignIn != value)
                {
                    _autoSignIn = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Connectivity")]
        [DisplayName("Server Url")]
        [Description("Specifies the url to use to connect to the CodeStream service")]
        public string ServerUrl
        {
            get => _serverUrl;
            set
            {
                if (_serverUrl != value)
                {
                    _serverUrl = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Connectivity")]
        [DisplayName("Web App Url")]
        [Description("Specifies the url for the CodeStream web portal")]
        public string WebAppUrl
        {
            get => _webAppUrl;
            set
            {
                if (_webAppUrl != value)
                {
                    _webAppUrl = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Connectivity")]
        [DisplayName("Proxy Url")]
        [Description("Specifies an optional proxy url")]
        public string ProxyUrl
        {
            get => _proxyUrl;
            set
            {
                if (_proxyUrl != value)
                {
                    _proxyUrl = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Connectivity")]
        [DisplayName("Proxy Strict SSL")]
        [Description("Specifies where the proxy server certificate should be verified against the list of supplied CAs")]
        public bool ProxyStrictSsl
        {
            get => _proxyStrictSsl;
            set
            {
                if (_proxyStrictSsl != value)
                {
                    _proxyStrictSsl = value;
                    NotifyPropertyChanged();
                }
            }
        }


        [Category("UI")]
        [DisplayName("Show Markers")]
        [Description("Specifies whether to show CodeStream markers in editor margins")]
        public bool ShowMarkers
        {
            get => _showMarkers;
            set
            {
                if (_showMarkers != value)
                {
                    _showMarkers = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("UI")]
        [DisplayName("Avatars")]
        [Description("Specifies whether to show avatars")]
        public bool ShowHeadshots
        {
            get => _showHeadshots;
            set
            {
                if (_showHeadshots != value)
                {
                    _showHeadshots = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("UI")]
        [DisplayName("Open Comment On Select")]
        [Description(
            "Specifies whether to automatically open the comment dialog when the CodeStream panel is open and you select code")]
        public bool OpenCommentOnSelect
        {
            get => _openCommentOnSelect;
            set
            {
                if (_openCommentOnSelect != value)
                {
                    _openCommentOnSelect = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("UI")]
        [DisplayName("Mute All")]
        [Description("Specifies whether to indicate when new messages arrive")]
        public bool MuteAll
        {
            get => _muteAll;
            set
            {
                if (_muteAll != value)
                {
                    _muteAll = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Other")]
        [DisplayName("Trace Level")]
        [Description("Specifies how much (if any) output will be sent to the CodeStream log")]
        public TraceLevel TraceLevel
        {
            get => _traceLevel;
            set
            {
                if (_traceLevel != value)
                {
                    _traceLevel = value;
                    NotifyPropertyChanged();
                }
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;
    }
}