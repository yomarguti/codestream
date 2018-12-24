using DotNetBrowser;
using DotNetBrowser.WPF;
using Microsoft.VisualStudio.Shell;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.Services
{
    /// <summary>
    /// Implementation of a browser service using DotNetBrowser
    /// </summary>
    public class DotNetBrowserService : BrowserServiceBase
    {
        /// <summary>
        /// Interface provided by DotNetBrowser (isn't prefixed with I)
        /// </summary>
        private readonly Browser _browser;
        private WPFBrowserView _browserView;
        private readonly IAsyncServiceProvider _serviceProvider;

        public DotNetBrowserService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;

#if DEBUG
            BrowserPreferences.SetChromiumSwitches("--remote-debugging-port=9222", "--disable-web-security", "--allow-file-access-from-files");
#else
            BrowserPreferences.SetChromiumSwitches("--disable-web-security", "--allow-file-access-from-files");
#endif
            _browserView = new WPFBrowserView(BrowserFactory.Create());

            // can theme it here
            //var bc = new System.Windows.Media.BrushConverter();
            //_browserView.Background = (System.Windows.Media.Brush)bc.ConvertFrom("#ff0000");

            _browser = _browserView.Browser;
        }

        public override void AddWindowMessageEvent(WindowMessageHandler handler)
        {
            _browser.ConsoleMessageEvent += delegate (object sender, DotNetBrowser.Events.ConsoleEventArgs e)
            {
                handler(sender, new WindowEventArgs(e.Message));
            };
        }

        public override void PostMessage(string message)
        {
            _browser.ExecuteJavaScript(@"window.postMessage(" + message + @",""*"");");
        }

        public override void LoadHtml(string html)
        {
            _browser.LoadHTML(html);
        }

        public override void AttachControl(Grid grid)
        {
            Grid.SetColumn(grid, 0);
            grid.Children.Add(_browserView);
        }

        public override string FooterHtml
        {
            get
            {
                return @"<script>
        window.addEventListener('message', function (e) {
            if (!e || e.type !== 'message' || e.data.type == null) return;
            console.log(JSON.stringify(e.data))
        }, false);        
    </script>";
            }
        }
    }
}
