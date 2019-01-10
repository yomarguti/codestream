using System.ComponentModel;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.UI.Settings;

namespace CodeStream.VisualStudio.UnitTests.Stubs
{
    public class OptionsDialogPageStub : IOptionsDialogPage
    {
        public event PropertyChangedEventHandler PropertyChanged;
        public string Email { get; set; }
        public bool ShowMarkers { get; set; }
        public bool ShowHeadshots { get; set; }
        public string ServerUrl { get; set; }
        public string WebAppUrl { get; set; }
        public string Team { get; set; }
        public bool OpenCommentOnSelect { get; set; }
        public void SaveSettingsToStorage() { }
        public void LoadSettingsFromStorage() { }
        public TraceLevel TraceLevel { get; set; }
        public bool AutoSignIn { get; set; }
    }
}
