using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Adornments;

namespace CodeStream.VisualStudio.UI
{
    public static class ActiveTextEditorExtensions
    {
        public static HighlightAdornmentManager GetHighlightAdornmentManager(this ActiveTextEditor editor)
        {
            if (editor?.TextView?.TextBuffer == null) return null;

            HighlightAdornmentManager ham = null;
            if (editor.TextView?.TextBuffer?.Properties.TryGetProperty(PropertyNames.AdornmentManager, out ham) ==
                true)
            {
                return ham;
            }

            return null;
        }
    }
}