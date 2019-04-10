using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Adornments;

namespace CodeStream.VisualStudio.UI
{
    public static class ActiveTextEditorExtensions
    {
        public static HighlightAdornmentManager GetHighlightAdornmentManager(this ActiveTextEditor editor)
        {
            if (editor?.WpfTextView?.TextBuffer == null) return null;

            HighlightAdornmentManager ham = null;
            if (editor.WpfTextView?.TextBuffer?.Properties.TryGetProperty(PropertyNames.AdornmentManager, out ham) ==
                true)
            {
                return ham;
            }

            return null;
        }
    }
}