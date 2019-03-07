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
    public interface IOptionsDialogPage : INotifyPropertyChanged
    {
        string Email { get; set; }
        bool ShowMarkers { get; set; }
        bool ShowHeadshots { get; set; }
        bool MuteAll { get; set; }
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string Team { get; set; }
        bool ViewCodemarksInline { get; set; }
        void SaveSettingsToStorage();
        void LoadSettingsFromStorage();
        TraceLevel TraceLevel { get; set; }
        bool AutoSignIn { get; set; }
        string ProxyUrl { get; set; }
        bool ProxyStrictSsl { get; set; }
        ProxySupport ProxySupport { get; set; }
        Proxy Proxy { get; }
    }

    public class OptionsDialogPage : DialogPage, IOptionsDialogPage
    {
        private string _email;
        private bool _showMarkers = true;
        private bool _showHeadshots = true;
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
        [DisplayName("Show Markers")]
        [Description("Specifies whether to show CodeStream markers in editor margins")]
        public bool ShowMarkers
        {
            get => _showMarkers;
            set
            {
                // NOTE: something off here -- state not working right in the webview...
                //if (_showMarkers != value)
                // {
                _showMarkers = value;
                    NotifyPropertyChanged();
               // }
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