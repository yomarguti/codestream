using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Reflection;
using System.Resources;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    // ReSharper disable once RedundantExtendsListEntry
    // ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
    public partial class WebViewControl : UserControl
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            InitializeComponent();

            var browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;

            if (browserService != null)
            {
                var resourceManager = new ResourceManager("VSPackage", Assembly.GetExecutingAssembly());

                browserService.AttachControl(Grid);
                // ReSharper disable once ResourceItemNotResolved
                browserService.LoadSplashView();

                var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

                if (sessionService.IsAgentReady)
                {
                    SetRouter(eventAggregator, browserService);
                }
                else
                {
                    // ReSharper disable once PossibleNullReferenceException
                    eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                    {
                        SetRouter(eventAggregator, browserService);
                    });
                }
            }
            else
            {
                Log.Warning("Browser service null");
            }
        }

        private void SetRouter(IEventAggregator eventAggregator, IBrowserService browserService)
        {
            var router = new WebViewRouter(
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
