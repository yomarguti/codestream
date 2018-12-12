using CodeStream.VisualStudio.Browsers;
using Serilog;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Windows;
using System.Windows.Controls;

namespace CodeStream.VisualStudio
{    
    /// <summary>
    /// Interaction logic for CodeStreamToolWindowControl.
    /// </summary>
    public partial class CodeStreamToolWindowControl : UserControl
    {
        
        static readonly ILogger log = LogManager.ForContext<CodeStreamToolWindowControl>();

        /// <summary>
        /// Initializes a new instance of the <see cref="CodeStreamToolWindowControl"/> class.
        /// </summary>
        public CodeStreamToolWindowControl()
        {
            IBrowser browser = new DotNetBrowserBrowser();
            var browserCommandHandler = new CodeStreamCommandHandler(browser);
            this.InitializeComponent();

            var dir = Directory.GetCurrentDirectory();
            var harness = File.ReadAllText($"{dir}/webview.html");
            harness = harness.Replace("{root}", dir.Replace(@"\", "/"));
            harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{File.ReadAllText($"{dir}/Themes/dark.css")}</style>");
            harness = harness.Replace("{footerHtml}", browser.FooterHtml);
            browser.AttachControl(grid);
            browser.AddWindowMessageEvent(delegate (object sender, WindowEventArgs ea)
            {
                  browserCommandHandler.Handle(ea);
            });

            browser.LoadHtml(harness);    
        }

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


        /// <summary>
        /// Handles click on the button by displaying a message box.
        /// </summary>
        /// <param name="sender">The event sender.</param>
        /// <param name="e">The event args.</param>
        [SuppressMessage("Microsoft.Globalization", "CA1300:SpecifyMessageBoxOptions", Justification = "Sample code")]
        [SuppressMessage("StyleCop.CSharp.NamingRules", "SA1300:ElementMustBeginWithUpperCaseLetter", Justification = "Default event handler naming pattern")]
        private void button1_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                string.Format(System.Globalization.CultureInfo.CurrentUICulture, "Invoked '{0}'", this.ToString()),
                "CodeStreamToolWindow");
        }
    }
}