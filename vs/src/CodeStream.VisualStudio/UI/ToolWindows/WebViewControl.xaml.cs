using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.PlatformUI;
using Serilog;
using System;
using System.IO;
using System.Reflection;
using System.Windows.Controls;
using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    public partial class WebViewControl : UserControl, IDisposable
    {
        static readonly ILogger log = LogManager.ForContext<WebViewControl>();

        private readonly IDisposable _languageServerReadySubscription;
        private readonly Assembly _assembly;
        private IBrowserService browser;

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            VSColorTheme.ThemeChanged += VSColorTheme_ThemeChanged;
            
            InitializeComponent();

            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;

            browser = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            var router = new WebViewRouter(eventAggregator, browser);

            //TODO gotta be a better way to embed & retrieve these???????

            _assembly = Assembly.GetAssembly(typeof(WebViewControl));

            string waitingHtml = null;
            using (var sr = new StreamReader(Path.GetDirectoryName(_assembly.Location) + "/UI/WebViews/waiting.html"))
            {
                waitingHtml = sr.ReadToEnd();
            }

            browser.AttachControl(grid);
            browser.LoadHtml(waitingHtml);

            _languageServerReadySubscription = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
              {                  
                  browser.AddWindowMessageEvent(async delegate (object sender, WindowEventArgs ea)
                  {
                      await router.HandleAsync(ea);
                  });

                  browser.LoadHtml(CreateHarness(_assembly, browser));
              });
        }

        private static string CreateHarness(Assembly assembly, IBrowserService browser)
        {
            string harness = null;
            var dir = Path.GetDirectoryName(assembly.Location);
            using (var sr = new StreamReader(dir + "/UI/WebViews/webview.html"))
            {
                harness = sr.ReadToEnd();
                harness = harness
                            .Replace("{root}", dir.Replace(@"\", "/"))
                            .Replace("{footerHtml}", browser.FooterHtml);
            }
            using (var sr = new StreamReader(dir + "/Themes/dark.css"))
            {
                var theme = sr.ReadToEnd();
                harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{Themeize(theme)}</style>");
            }
            return harness;
        }


        private static string Themeize(string theme)
        {            
            return theme
                .Replace("{color}", VSColorTheme.GetThemedColor(EnvironmentColors.ToolWindowTextColorKey).ToHex())
                .Replace("{background-color}", VSColorTheme.GetThemedColor(EnvironmentColors.ToolWindowBackgroundColorKey).ToHex())
                .Replace("{vscode-button-background}", VSColorTheme.GetThemedColor(EnvironmentColors.ToolWindowButtonDownColorKey).ToHex())
                .Replace("{vscode-button-hoverBackground}", VSColorTheme.GetThemedColor(EnvironmentColors.ToolWindowButtonDownColorKey).ToHex())
                ;
        }

        private void VSColorTheme_ThemeChanged(ThemeChangedEventArgs e)
        {
            //TODO uodate webviews
           // browser.LoadHtml(CreateHarness(_assembly, browser));
        }

        #region IDisposable Support
        private bool disposedValue = false; // To detect redundant calls

        protected virtual void Dispose(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing)
                {
                    VSColorTheme.ThemeChanged -= VSColorTheme_ThemeChanged;
                    _languageServerReadySubscription?.Dispose();
                    // TODO: dispose managed state (managed objects).
                }

                // TODO: free unmanaged resources (unmanaged objects) and override a finalizer below.
                // TODO: set large fields to null.

                disposedValue = true;
            }
        }

        // TODO: override a finalizer only if Dispose(bool disposing) above has code to free unmanaged resources.
        // ~CodeStreamToolWindowControl() {
        //   // Do not change this code. Put cleanup code in Dispose(bool disposing) above.
        //   Dispose(false);
        // }

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