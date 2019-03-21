using CodeStream.VisualStudio.UI;
using CodeStream.VisualStudio.UI.Adornments;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text.Editor;
using System;

namespace CodeStream.VisualStudio.Models
{
    public class ActiveTextEditor : ICanHighlightRange
    {
        public ActiveTextEditor(IWpfTextView textView, string filePath, Uri uri, int? totalLines)
        {
            TextView = textView;
            FilePath = filePath;
            Uri = uri;
            TotalLines = totalLines;
        }

        public IWpfTextView TextView { get; }
        public string FilePath { get; }
        public Uri Uri { get; }
        public int? TotalLines { get; }

        public void Highlight(Range range, bool highlight)
        {
            this.GetHighlightAdornmentManager()?.Highlight(range, highlight);
        }
    }
}