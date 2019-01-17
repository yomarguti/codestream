using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    // ReSharper disable once RedundantExtendsListEntry
    // ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
    public partial class WebViewControl : UserControl
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();
        private IDisposable _languageServerReadyEvent;

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            InitializeComponent();

            Log.Verbose($"{nameof(OnInitialized)}...");

            var browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;

            if (browserService != null)
            {
                browserService.Initialize();
                browserService.AttachControl(Grid);
                browserService.LoadSplashView();

                var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                if (sessionService == null)
                {
                    Log.Warning("SessionService is null");
                }
                else
                {
                    if (sessionService.IsAgentReady)
                    {
                        SetRouter(eventAggregator, browserService);
                    }
                    else
                    {
                        // ReSharper disable once PossibleNullReferenceException
                        _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                        {
                            SetRouter(eventAggregator, browserService);
                            _languageServerReadyEvent.Dispose();
                        });
                    }
                }
            }
            else
            {
                Log.Warning("BrowserService is null");
            }

            Log.Verbose($"{nameof(OnInitialized)}");
        }

        private void SetRouter(IEventAggregator eventAggregator, IBrowserService browserService)
        {
            var router = new WebViewRouter(
                   new Lazy<ICredentialsService>(() => Package.GetGlobalService(typeof(SCredentialsService)) as ICredentialsService),
                       Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
                       Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                       Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService,
                       eventAggregator,
                       browserService,
                       Package.GetGlobalService(typeof(SIdeService)) as IIdeService);

            browserService.AddWindowMessageEvent(async delegate (object sender, WindowEventArgs ea)
            {
                await router.HandleAsync(ea);
            });

            browserService.LoadWebView();
        }
    }
}