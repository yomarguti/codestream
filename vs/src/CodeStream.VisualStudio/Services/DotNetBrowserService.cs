using CodeStream.VisualStudio.Extensions;
using DotNetBrowser;
using DotNetBrowser.WPF;
using Microsoft.VisualStudio.Shell;
using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.Services
{
    /// <summary>
    /// Implementation of a browser service using DotNetBrowser
    /// </summary>
    public class DotNetBrowserService : BrowserServiceBase
    {
        /// <summary>
        /// For improved LIGHTWEIGHT rendering
        /// </summary>
        /// <remarks>see https://dotnetbrowser.support.teamdev.com/support/solutions/articles/9000124916-accelerated-lightweight-rendering</remarks>
        private static readonly List<string> ChromiumSwitches = new List<string>
        {
            "--disable-gpu",
            "--disable-gpu-compositing",
            "--enable-begin-frame-scheduling",
            "--software-rendering-fps=60",
            "--disable-web-security",
            "--allow-file-access-from-files"
        };

        private static readonly List<string> ChromiumSwitchesDebug = new List<string>
        {
            "--remote-debugging-port=9222"
        };

        /// <summary>
        /// Interface provided by DotNetBrowser (isn't prefixed with I)
        /// </summary>
        private readonly Browser _browser;
        private readonly WPFBrowserView _browserView;
        // ReSharper disable once NotAccessedField.Local
        private readonly IAsyncServiceProvider _serviceProvider;

        public DotNetBrowserService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;

            var switches = ChromiumSwitches;
#if DEBUG
            switches = switches.Combine(ChromiumSwitchesDebug);
#endif
            BrowserPreferences.SetChromiumSwitches(switches.ToArray());

            // use LIGHTWEIGHT to avoid "System.InvalidOperationException: 'The specified Visual is not an ancestor of this Visual.'"
            var browser = BrowserFactory.Create(BrowserType.LIGHTWEIGHT);
            _browserView = new WPFBrowserView(browser);
            _browser = _browserView.Browser;
        }

        public override void AddWindowMessageEvent(WindowMessageHandler handler)
        {
            _browser.ConsoleMessageEvent += async delegate (object sender, DotNetBrowser.Events.ConsoleEventArgs e)
            {
                await handler(sender, new WindowEventArgs(e.Message));
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

        public override void AttachControl(FrameworkElement frameworkElement)
        {
            var grid = frameworkElement as Grid;
            if (grid == null)
                throw new InvalidOperationException("Grid");

            Grid.SetColumn(grid, 0);
            grid.Children.Add(_browserView);
        }

        private bool _disposed;
        protected override void Dispose(bool disposing)
        {
            if (_disposed) return;

            if (disposing)
            {
                _browserView.Dispose();
            }

            base.Dispose(disposing);
            _disposed = true;
        }

        public override string FooterHtml
        {
            get
            {
                return @"<script>
        window.addEventListener('message', function (e) {
            if (!e || e.type !== 'message' || e.data.type == null) return;

            var str = JSON.stringify(e.data);
            if (!str || str[0] !== '{') return;
            
            console.log(str);

        }, false);        
    </script>";
            }
        }
    }
}
