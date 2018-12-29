namespace CodeStream.VisualStudio.UI.Settings
{
    public interface IOptionsDialogPage
    {
        string Email { get; set; }
        bool ShowMarkers { get; set; }
        bool ShowHeadshots { get; set; }
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string Team { get; set; }
        bool OpenCommentOnSelect { get; set; }
        void SaveSettingsToStorage();
        void LoadSettingsFromStorage();
    }
}