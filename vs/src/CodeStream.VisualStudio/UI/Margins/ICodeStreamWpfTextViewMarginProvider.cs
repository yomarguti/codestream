using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.UI.Margins
{
    /// <summary>
    /// Marker interface
    /// </summary>
    public interface ICodeStreamWpfTextViewMarginProvider : IWpfTextViewMarginProvider
    {
        ITextDocumentFactoryService TextDocumentFactoryService { get; set; }
        ICodeStreamWpfTextViewMargin TextViewMargin { get; }
    }

    public interface ICodeStreamWpfTextViewMargin : IWpfTextViewMargin
    {
        bool IsReady();
        bool CanToggleMargin { get; }
        void OnSessionLogout();
        void OnSessionReady();
        void OnMarkerChanged();
        void HideMargin();
        void ShowMargin();
        void ToggleMargin(bool isVisible);
        void RefreshMargin();
        void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e);
    }
}
