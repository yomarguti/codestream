namespace CodeStream.VisualStudio
{
    using CodeStream.VisualStudio.Extensions;
    using CodeStream.VisualStudio.Services;
    using Microsoft.VisualStudio.Shell;
    using Newtonsoft.Json.Linq;
    using System;
    using System.Diagnostics.CodeAnalysis;
    using System.Windows;
    using System.Windows.Controls;
    using System.Windows.Media;

    /// <summary>
    /// Interaction logic for CodeStreamDebugControl.
    /// </summary>
    public partial class CodeStreamDebugControl : UserControl
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="CodeStreamDebugControl"/> class.
        /// </summary>
        public CodeStreamDebugControl()
        {
            this.InitializeComponent();
        }


        public static SolidColorBrush ToSolidColorBrush(string hex_code)
        {
            return (SolidColorBrush)new BrushConverter().ConvertFromString(hex_code);
        }

        /// <summary>
        /// Handles click on the button by displaying a message box.
        /// </summary>
        /// <param name="sender">The event sender.</param>
        /// <param name="e">The event args.</param>
        [SuppressMessage("Microsoft.Globalization", "CA1300:SpecifyMessageBoxOptions", Justification = "Sample code")]
        [SuppressMessage("StyleCop.CSharp.NamingRules", "SA1300:ElementMustBeginWithUpperCaseLetter", Justification = "Default event handler naming pattern")]
        private async void button1_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Results.Background = ToSolidColorBrush("#98FB98");

                var codeStreamAgent = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;

                var parameters = string.IsNullOrWhiteSpace(Params.Text) ? null : JToken.Parse(Params.Text);
                var results = await codeStreamAgent.SendAsync<object>(Request.Text, parameters);
                Results.Text = results.ToJson();
            }
            catch (Exception ex)
            {
                Results.Text = ex.ToJson();
                Results.Background = ToSolidColorBrush("#CC9933");
            }
        }
    }
}