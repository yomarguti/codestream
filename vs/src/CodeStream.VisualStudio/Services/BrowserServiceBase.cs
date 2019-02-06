using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Resources;
using System.Windows;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services
{
    public class WindowEventArgs
    {
        public WindowEventArgs(string message)
        {
            Message = message;
        }

        public string Message { get; }
    }

    public interface SBrowserService { }

    public interface IBrowserService : IDisposable
    {
        void Initialize();
        /// <summary>
        /// Sends the string to the web view
        /// </summary>
        /// <param name="message"></param>
        void PostMessage(string message);
        /// <summary>
        /// Object to be JSON-serialized before sending to the webview
        /// </summary>
        /// <param name="message"></param>
        void PostMessage(object message);

        void LoadHtml(string html);
        void AddWindowMessageEvent(WindowMessageHandler messageHandler);
        /// <summary>
        /// Attaches the control to the parent element
        /// </summary>
        /// <param name="frameworkElement"></param>
        void AttachControl(FrameworkElement frameworkElement);
        /// <summary>
        /// Loads the webview
        /// </summary>
        void LoadWebView();
        /// <summary>
        /// waiting / loading / pre-LSP page
        /// </summary>
        void LoadSplashView();
        /// <summary>
        /// Reloads the webview completely
        /// </summary>
        void ReloadWebView();
    }

    public delegate Task WindowMessageHandler(object sender, WindowEventArgs e);

    public abstract class BrowserServiceBase : IBrowserService, SBrowserService
    {
        private static readonly ILogger Log = LogManager.ForContext<BrowserServiceBase>();

        public virtual void Initialize()
        {
            Log.Verbose($"{GetType()} {nameof(Initialize)} Browser...");
            OnInitialized();
            Log.Verbose($"{GetType()} {nameof(Initialize)} Browser");
        }

        protected virtual void OnInitialized()
        {

        }

        public abstract void AddWindowMessageEvent(WindowMessageHandler messageHandler);

        public abstract void AttachControl(FrameworkElement frameworkElement);

        public virtual void LoadHtml(string html) { }

        public virtual void PostMessage(string message) { }

        public virtual void PostMessage(object message)
        {
            PostMessage(message.ToJson());
        }

        public void LoadWebView()
        {
            LoadHtml(CreateWebViewHarness(Assembly.GetAssembly(typeof(BrowserServiceBase)), "webview"));
        }

        public void LoadSplashView()
        {
            LoadHtml(CreateWebViewHarness(Assembly.GetAssembly(typeof(BrowserServiceBase)), "waiting"));
        }

        public void ReloadWebView()
        {
            LoadWebView();
            Log.Verbose($"{nameof(ReloadWebView)}");
        }

        private string CreateWebViewHarness(Assembly assembly, string resourceName)
        {
            var resourceManager = new ResourceManager("VSPackage", Assembly.GetExecutingAssembly());
            var dir = Path.GetDirectoryName(assembly.Location);
            Debug.Assert(dir != null, nameof(dir) + " != null");

            // ReSharper disable once ResourceItemNotResolved
            var harness = resourceManager.GetString(resourceName);
            Debug.Assert(harness != null, nameof(harness) + " != null");

            harness = harness
                        .Replace("{root}", dir.Replace(@"\", "/"));
            // ReSharper disable once ResourceItemNotResolved
            var styleSheet = resourceManager.GetString("theme");

            var themeGenerator = ThemeManager.Generate();
            harness = harness.Replace("{bodyClass}", themeGenerator.IsDark ? "vscode-dark" : "vscode-light");
            if (styleSheet != null)
            {
                foreach (var item in themeGenerator.ColorInfo)
                {
                    string value;
                    if (!item.Value.IsNullOrWhiteSpace())
                    {
                        value = item.Value;
                    }
                    else
                    {
                        var color = VSColorTheme.GetThemedColor(item.VisualStudioKey);
                        value = item.Modifier == null ? color.ToHex() : item.Modifier(color);
                    }

                    styleSheet = styleSheet.Replace($"--cs--{item.Key}--", value);
                }
            }

           harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{styleSheet}</style>");
#if RELEASE
            Log.Verbose(harness);
#endif
            return harness;
        }

        private bool _isDisposed;
        public void Dispose()
        {
            if (!_isDisposed)
            {
                Log.Verbose("Browser Dispose...");

                Dispose(true);
                _isDisposed = true;
            }
        }

        protected virtual void Dispose(bool disposing)
        {
        }


    }

    public class NullBrowserService : BrowserServiceBase
    {
        // ReSharper disable once NotAccessedField.Local
        private readonly IAsyncServiceProvider _serviceProvider;
        public NullBrowserService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public override void AddWindowMessageEvent(WindowMessageHandler messageHandler)
        {

        }

        public override void AttachControl(FrameworkElement frameworkElement)
        {

        }
    }
}