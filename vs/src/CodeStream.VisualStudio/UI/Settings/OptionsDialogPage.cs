using System.ComponentModel;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.UI.Settings
{
    public class OptionsDialogPage : DialogPage, IOptionsDialogPage
    {
        [Category("CodeStream")]
        [DisplayName("Email")]
        [Description("")]
        public string Email { get; set; }

        [Category("CodeStream")]
        [DisplayName("Show Markers")]
        [Description("Specifies whether to show CodeStream markers in editor margins")]
        public bool ShowMarkers { get; set; } = true;

        [Category("CodeStream")]
        [DisplayName("Avatars")]
        [Description("Specifies whether to show avatars")]
        public bool ShowHeadshots { get; set; } = true;

        [Category("CodeStream")]
        [DisplayName("Server Url")]
        [Description("Specifies the url to use to connect to the CodeStream service")]
#if DEBUG
        public string ServerUrl { get; set; } = "https://pd-api.codestream.us:9443";
#else 
        public string ServerUrl { get; set; } = "https://api.codestream.com";
#endif

        [Category("CodeStream")]
        [DisplayName("Web App Url")]
        [Description("Specifies the url for the CodeStream web portal")]
#if DEBUG
        public string WebAppUrl { get; set; } = "http://pd-app.codestream.us:1380";
#else
        public string WebAppUrl { get; set; } = "http://app.codestream.com";
#endif

        [Category("CodeStream")]
        [DisplayName("Team")]
        [Description("Specifies an optional team to connect to the CodeStream service")]
        public string Team { get; set; }

        [Category("CodeStream")]
        [DisplayName("Open Comment On Select")]
        [Description("Specifies whether to automatically open the comment dialog when the CodeStream panel is open and you select code")]
        public bool OpenCommentOnSelect { get; set; } = true;
    }
}