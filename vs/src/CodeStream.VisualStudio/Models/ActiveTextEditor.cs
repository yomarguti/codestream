using System;
using CodeStream.VisualStudio.UI;
using CodeStream.VisualStudio.UI.Adornments;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.Models
{
    public class ActiveTextEditor: ICanHighlightRange
    {
        public IWpfTextView TextView { get; set; }
        public string FilePath { get; set; }
        public Uri Uri { get; set; }

        public void Highlight(Range range, bool highlight)
        {
            this.GetHighlightAdornmentManager()?.Highlight(range, highlight);
        }
    }
}