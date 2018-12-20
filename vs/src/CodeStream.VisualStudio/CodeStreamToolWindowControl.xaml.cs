using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.IO;
using System.Windows.Controls;

namespace CodeStream.VisualStudio
{
    public partial class CodeStreamToolWindowControl : UserControl, IDisposable
    {
        static readonly ILogger log = LogManager.ForContext<CodeStreamToolWindowControl>();

        private readonly IDisposable _languageServerReadySubscription;

        /// <summary>
        /// Initializes a new instance of the <see cref="CodeStreamToolWindowControl"/> class.
        /// </summary>
        public CodeStreamToolWindowControl()
        {
            InitializeComponent();
            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;

            IBrowserService browser = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            var browserCommandHandler = new CodeStreamCommandHandler(eventAggregator, browser);

            browser.AttachControl(grid);
            browser.LoadHtml("Open a solution and a file to start using CodeStream!");

            _languageServerReadySubscription = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
              {
                  var dir = Directory.GetCurrentDirectory();
                  var harness = File.ReadAllText($"{dir}/webview.html");
                  harness = harness.Replace("{root}", dir.Replace(@"\", "/"));
                  harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{File.ReadAllText($"{dir}/Themes/dark.css")}</style>");
                  harness = harness.Replace("{footerHtml}", browser.FooterHtml);

                  browser.AddWindowMessageEvent(async delegate (object sender, WindowEventArgs ea)
                  {
                      await browserCommandHandler.HandleAsync(ea);
                  });

                  browser.LoadHtml(harness);
              });
        }

        #region IDisposable Support
        private bool disposedValue = false; // To detect redundant calls

        protected virtual void Dispose(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing)
                {
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