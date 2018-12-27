using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Resources;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    public partial class WebViewControl : UserControl, IDisposable
    {
        static readonly ILogger log = LogManager.ForContext<WebViewControl>();

        private readonly IDisposable _languageServerReadySubscription;
        private readonly Assembly _assembly;
        private readonly IBrowserService _browserService;
        private readonly ResourceManager _resourceManager;

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            _assembly = Assembly.GetAssembly(typeof(WebViewControl));
            _resourceManager = new ResourceManager("VSPackage", Assembly.GetExecutingAssembly());

            VSColorTheme.ThemeChanged += VSColorTheme_ThemeChanged;

            InitializeComponent();

            _browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
            // var serviceProviderLocator = Package.GetGlobalService(typeof(SServiceProviderLocator)) as IServiceProviderLocator;

            _browserService.AttachControl(grid);
            _browserService.LoadHtml(_resourceManager.GetString("waiting"));

            var router = new WebViewRouter(null, eventAggregator, _browserService);
            _languageServerReadySubscription = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
              {
                  _browserService.AddWindowMessageEvent(async delegate (object sender, WindowEventArgs ea)
                  {
                      await router.HandleAsync(ea);
                  });

                  _browserService.LoadHtml(CreateHarness(_assembly));
              });
        }

        private string CreateHarness(Assembly assembly)
        {
            string harness = null;
            var dir = Path.GetDirectoryName(assembly.Location);

            harness = _resourceManager.GetString("webview");
            harness = harness
                        .Replace("{root}", dir.Replace(@"\", "/"))
                        .Replace("{footerHtml}", _browserService.FooterHtml);

            var theme = _resourceManager.GetString("theme");
            harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{Themeize(theme)}</style>");

            return harness;
        }

        private static string Themeize(string theme)
        {
            //var d = new System.Collections.Generic.Dictionary<string, string>();
            //Type type = typeof(EnvironmentColors); // MyClass is static class with static properties
            //foreach (var p in type.GetProperties().Where(_ => _.Name.StartsWith("ToolWindow")))
            //{
            //    var val = typeof(EnvironmentColors).GetProperty(p.Name, BindingFlags.Public | BindingFlags.Static);
            //    var v = val.GetValue(null);
            //    var trk = v as ThemeResourceKey;
            //    if (trk != null)
            //    {
            //        var color = VSColorTheme.GetThemedColor(trk);
            //        d.Add(p.Name, color.ToHex());
            //    }

            //    // d.Add(p.Name, ((System.Drawing.Color)val).ToHex());
            //}

            //string s = "";
            //foreach (var kvp in d)
            //{
            //    s += $@"<div>";
            //    s += $@"<span style='display:inline-block; height:50ps; width: 50px; background:{kvp.Value}; padding-right:5px; margin-right:5px;'>&nbsp;</span>";
            //    s += $@"<span>{kvp.Value} - {kvp.Key}</span>";
            //    s += "</div>";
            //}

            foreach (var item in ColorThemeMap)
            {
                theme = theme.Replace("--cs--" + item.Key + "--", VSColorTheme.GetThemedColor(item.Value).ToHex());
            }
            var fontFamilyString = "Arial, Consolas, sans-serif";
            var fontFamily = System.Windows.Application.Current.FindResource(VsFonts.EnvironmentFontFamilyKey) as FontFamily;
            if (fontFamily != null)
            {
                fontFamilyString = fontFamily.ToString();
            }

            theme = theme.Replace("--cs--font-family--", fontFamilyString);
            theme = theme.Replace("--cs--vscode-editor-font-family--", fontFamilyString);

            var fontSizeInt = 13;
            var fontSize = System.Windows.Application.Current.FindResource(VsFonts.EnvironmentFontSizeKey);
            if (fontSize != null)
            {
                fontSizeInt = int.Parse(fontSize.ToString());
            }
            theme = theme.Replace("--cs--font-size--", fontSizeInt.ToString());

            theme = theme.Replace("--cs--background-color-darker--", VSColorTheme.GetThemedColor(EnvironmentColors.ToolWindowBackgroundColorKey).Darken().ToHex());
            return theme;
        }

        private static Dictionary<string, ThemeResourceKey> ColorThemeMap = new Dictionary<string, ThemeResourceKey>
        {
            {"app-background-color",                   EnvironmentColors.ToolWindowBackgroundColorKey},
            {"base-border-color",                      EnvironmentColors.ToolWindowBorderColorKey},
            {"color",                                  EnvironmentColors.ToolWindowTextColorKey},
            {"background-color",                       EnvironmentColors.ToolWindowBackgroundColorKey},
            {"link-color",                             EnvironmentColors.ToolWindowTextColorKey},

            {"vscode-button-hoverBackground",          EnvironmentColors.ToolWindowButtonDownBorderColorKey},
            {"vscode-sideBarSectionHeader-background", EnvironmentColors.ToolWindowContentGridColorKey},
            {"vscode-sideBarSectionHeader-foreground", EnvironmentColors.ToolWindowTextColorKey},

            {"vs-accent-color",                        EnvironmentColors.ToolWindowButtonInactiveColorKey},

            {"vs-btn-background",                      EnvironmentColors.ToolWindowButtonInactiveGlyphColorKey},
            {"vs-btn-color",                           EnvironmentColors.ToolWindowButtonHoverActiveGlyphColorKey},

            {"vs-btn-primary-background",              EnvironmentColors.ToolWindowButtonDownColorKey},
            {"vs-btn-primary-color",                   EnvironmentColors.ToolWindowButtonDownActiveGlyphColorKey},

            {"vs-input-background",                    EnvironmentColors.ToolWindowButtonHoverInactiveColorKey},
            {"vs-background-accent",                   EnvironmentColors.ToolWindowTabMouseOverBackgroundBeginColorKey},
            {"vs-input-outline",                       EnvironmentColors.ToolWindowButtonHoverActiveBorderColorKey},
            {"vs-post-separator",                      EnvironmentColors.ToolWindowBorderColorKey},
        };

        private void VSColorTheme_ThemeChanged(ThemeChangedEventArgs e)
        {
            _browserService.LoadHtml(CreateHarness(_assembly));
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
