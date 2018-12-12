using DotNetBrowser;
using DotNetBrowser.WPF;
using System;
using System.Windows.Controls;
using System.Windows.Media;

namespace CodeStream.VisualStudio.Browsers
{
    public class DotNetBrowserBrowser : BrowserBase
    {
        private Browser _browser;
        private WPFBrowserView _browserView;
        public DotNetBrowserBrowser()
        {
            BrowserPreferences.SetChromiumSwitches("--remote-debugging-port=9222", "--disable-web-security", "--allow-file-access-from-files");
            _browserView = Activator.CreateInstance(typeof(WPFBrowserView)) as WPFBrowserView;

            //var bc = new BrushConverter();
            //  _browserView.Background = (System.Windows.Media.Brush)bc.ConvertFrom("#ff0000");

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
