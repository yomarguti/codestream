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
                browserService.LoadHtml(resourceManager.GetString("waiting"));
                
                var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;

                // ReSharper disable once PossibleNullReferenceException

                // this event is disposed in an outer scope -- see CodeStreamPackage
                eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                {
                    var router = new WebViewRouter(
                        Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
                        Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                        Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService,
                        eventAggregator,
                        browserService,
                        Package.GetGlobalService(typeof(SIdeService)) as IIdeService);

                    browserService.AddWindowMessageEvent(async delegate(object sender, WindowEventArgs ea)
                    {
                        await router.HandleAsync(ea);
                    });

                    browserService.LoadWebView();
                });
            }
            else
            {
                Log.Warning("Browser service null");
            }
        }        
    }
}
