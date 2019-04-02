using System;
using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.Shell;
using System.ComponentModel;
using System.Net;
using System.Runtime.CompilerServices;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.UI.Settings
{
    public interface IOptions
    {
        string Email { get; set; }
        string Team { get; set; }
        bool ShowAvatars { get; set; }
        bool MuteAll { get; set; }
        bool AutoSignIn { get; set; }

        bool AutoHideMarkers { get; set; }
        //bool ShowMarkerCodeLens { get; set; }
        bool ShowMarkerGlyphs { get; set; }
        bool ShowFeedbackSmiley { get; set; }
        bool ViewCodemarksInline { get; set; }

        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string ProxyUrl { get; set; }
        bool ProxyStrictSsl { get; set; }
        ProxySupport ProxySupport { get; set; }
    }

    public interface IOptionsDialogPage : IOptions, INotifyPropertyChanged
    {
        Proxy Proxy { get; }

        void SaveSettingsToStorage();
        void LoadSettingsFromStorage();
        TraceLevel TraceLevel { get; set; }
    }

    public class OptionsDialogPage : DialogPage, IOptionsDialogPage
    {
        private string _email;
        private bool _autoHideMarkers = true;
        private bool _showFeedbackSmiley = true;
        
        //// not supported yet
        //private bool _showMarkerCodeLens = false;
        private bool _showMarkerGlyphs = true;
         
        private bool _showAvatars = true;
        private bool _muteAll = false;
        private TraceLevel _traceLevel;
        private bool _viewCodemarksInline = true;
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
        private ProxySupport _proxySupport;

        public OptionsDialogPage()
        {
            ProxySetup();
        }

        [Browsable(false)]
        public Proxy Proxy { get; private set; }

        private void NotifyPropertyChanged([CallerMemberName] string propertyName = "")
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        private void ProxySetup()
        {
            if (ProxySupport == ProxySupport.Off) return;

            try
            {
                var webProxy = WebRequest.GetSystemWebProxy();
                var serverUri = new Uri(ServerUrl);
                var possibleProxyUri = webProxy.GetProxy(new Uri(ServerUrl));

                if (!possibleProxyUri.EqualsIgnoreCase(serverUri))
                {
                    // has a system proxy
                    Proxy = new Proxy
                    {
                        Url = possibleProxyUri.ToString(),
                        StrictSsl = ProxyStrictSsl
                    };
                }
                else
                {
                    if (!ProxyUrl.IsNullOrWhiteSpace())
                    {
                        _proxySupport = ProxySupport.Override;
                        Proxy = new Proxy
                        {
                            Url = ProxyUrl,
                            StrictSsl = ProxyStrictSsl
                        };
                    }
                }
            }
            catch
            {
                // suffer silently
            }
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
                    ProxySetup();
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
                    ProxySetup();
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("Connectivity")]
        [DisplayName("Proxy Support")]
        [Description("Specifies how proxies are handled. [On] Your system-level proxy will be used, if set. [Off] No support. [Override] The ProxyUrl value will be used, if set.")]
        public ProxySupport ProxySupport
        {
            get => _proxySupport;
            set
            {
                if (_proxySupport != value)
                {
                    _proxySupport = value;
                    ProxySetup();
                    NotifyPropertyChanged();
                }
            }
        }
        [Category("UI")]
        [DisplayName()]
        [Description("Specifies whether to automatically hide editor marker glyphs when the CodeStream panel is showing codemarks in the current file")]
        public bool AutoHideMarkers
        {
            get => _autoHideMarkers;
            set
            {
                _autoHideMarkers = value;
                NotifyPropertyChanged();
            }
        }

        //[Category("UI")]
        //[DisplayName("Show Marker CodeLens")]
        //[Description("Specifies whether to show code lens above lines with associated codemarks in the editor")]
        //public bool ShowMarkerCodeLens
        //{
        //    get => _showMarkerCodeLens;
        //    set
        //    {
        //        _showMarkerCodeLens = value;
        //        NotifyPropertyChanged();
        //    }
        //}

        [Category("UI")]
        [DisplayName("Show Marker Glyphs")]
        [Description("Specifies whether to show glyph indicators at the start of lines with associated codemarks in the editor")]
        public bool ShowMarkerGlyphs
        {
            get => _showMarkerGlyphs;
            set
            {
                _showMarkerGlyphs = value;
                NotifyPropertyChanged();
            }
        }

        [Category("UI")]
        [DisplayName("Show Feedback Smiley")]
        [Description("Specifies whether to show a feedback button in the CodeStream panel")]
        public bool ShowFeedbackSmiley
        {
            get => _showFeedbackSmiley;
            set
            {
                _showFeedbackSmiley = value;
                NotifyPropertyChanged();
            }
        }

        [Category("UI")]
        [DisplayName("Show Avatars")]
        [Description("Specifies whether to show avatars")]
        public bool ShowAvatars
        {
            get => _showAvatars;
            set
            {
                if (_showAvatars != value)
                {
                    _showAvatars = value;
                    NotifyPropertyChanged();
                }
            }
        }

        [Category("UI")]
        [DisplayName("View Codemarks inline")]
        [Description("Specifies whether to display Codemarks inline next to the code they refer to. The alternative is a list view.")]
        public bool ViewCodemarksInline
        {
            get => _viewCodemarksInline;
            set
            {
                // NOTE: something off here -- state not working right in the webview...
                //if (_viewCodemarksInline != value)
                //{
                    _viewCodemarksInline = value;
                    NotifyPropertyChanged();
                //}
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
                // NOTE: something off here -- state not working right in the webview...
                //if (_muteAll != value)
                //{
                    _muteAll = value;
                    NotifyPropertyChanged();
                //}
            }
        }

        [Category("Other")]
        [DisplayName("Trace Level")]
        [Description("Specifies how much (if any) output will be sent to the CodeStream log")]
        public TraceLevel TraceLevel
        {
	        get { return _traceLevel; }
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
