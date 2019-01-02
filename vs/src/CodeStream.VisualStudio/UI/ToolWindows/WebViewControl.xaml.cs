using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Reflection;
using System.Resources;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    public partial class WebViewControl : UserControl, IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();

        private readonly IDisposable _languageServerReadySubscription;
        private readonly IBrowserService _browserService;
        private readonly ResourceManager _resourceManager;

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            _resourceManager = new ResourceManager("VSPackage", Assembly.GetExecutingAssembly());

            VSColorTheme.ThemeChanged += VSColorTheme_ThemeChanged;

            InitializeComponent();

            _browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;

            _browserService.AttachControl(grid);
            _browserService.LoadHtml(_resourceManager.GetString("waiting"));

            var router = new WebViewRouter(null, eventAggregator, _browserService);
            _languageServerReadySubscription = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
              {
                  _browserService.AddWindowMessageEvent(async delegate (object sender, WindowEventArgs ea)
                  {
                      await router.HandleAsync(ea);
                  });

                  _browserService.LoadWebView();
              });
        }
     
        private void VSColorTheme_ThemeChanged(ThemeChangedEventArgs e)
        {
            Log.Verbose(nameof(VSColorTheme_ThemeChanged));

            _browserService.LoadWebView();
        }

        #region IDisposable Support
        private bool _disposedValue = false; // To detect redundant calls

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposedValue)
            {
                if (disposing)
                {
                    VSColorTheme.ThemeChanged -= VSColorTheme_ThemeChanged;
                    _languageServerReadySubscription?.Dispose();
                    _browserService?.Dispose();
                }

                _disposedValue = true;
            }
        }

        // This code added to correctly implement the disposable pattern.
        public void Dispose()
        {
            // Do not change this code. Put cleanup code in Dispose(bool disposing) above.
            Dispose(true);
            // TODO: uncomment the following line if the finalizer is overridden above.
            // GC.SuppressFinalize(this);
        }
        #endregion


        //private void Browser_Initialized(object sender, EventArgs e)
        //{
        //}

        //private void Browser_FinishLoadingFrameEvent(object sender, DotNetBrowser.Events.FinishLoadingEventArgs e)
        //{
        //    if (e.IsMainFrame)
        //    {
        //        //DOMDocument document = e.Browser.GetDocument();
        //        //List<DOMNode> inputs = document.GetElementsByTagName("body");
        //        //var body = inputs[0] as DOMElement;                
        //        //body.SetAttribute("style", "--app-background-color:green;");
        //        //var f = Browser.Browser.CreateEvent("message");
        //        //body.AddEventListener(f, OnMessage, false);
        //        //foreach (DOMNode node in inputs)
        //        //{
        //        //    DOMElement element = node as DOMElement;
        //        //    if (element.GetAttribute("type").ToLower().Equals("submit"))
        //        //    {
        //        //        element.AddEventListener(DOMEventType.OnClick, OnSubmitClicked, false);
        //        //    }
        //        //}
        //    }
        //}
    }
}
