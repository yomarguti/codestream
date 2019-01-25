using System;
using System.Collections.Generic;
using System.Linq;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Glyphs;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;

namespace CodeStream.VisualStudio.UI.Taggers
{
    /// <summary>
    ///     Responsible for matching Codemarks up to a line
    /// </summary>
    internal class CodemarkTagger : ITagger<CodemarkGlyphTag>
    {
        private readonly ITextBuffer _buffer;
        private readonly ITextDocument _textDocument;
        private readonly ITextView _textView;

        public CodemarkTagger(ITextView textView, ITextDocument textDocument, ITextBuffer buffer)
        {
            _textView = textView;
            _textDocument = textDocument;
            _buffer = buffer;
        }
#pragma warning disable 67
        public event EventHandler<SnapshotSpanEventArgs> TagsChanged;
#pragma warning restore 67

        IEnumerable<ITagSpan<CodemarkGlyphTag>> ITagger<CodemarkGlyphTag>.GetTags(
            NormalizedSnapshotSpanCollection spans)
        {
            List<CsFullMarker> markers = null;
            if (_textDocument.TextBuffer.Properties.ContainsProperty(PropertyNames.CodemarkMarkers))
                markers = _textDocument.TextBuffer.Properties.GetProperty<List<CsFullMarker>>(PropertyNames.CodemarkMarkers);

            if (markers != null && markers.AnySafe())
                foreach (var span in spans)
                {
                    var lineNumber = span.Start.GetContainingLine().LineNumber;
                    var codemark = markers?.FirstOrDefault(_ => _?.Range?.Start.Line == lineNumber);
                    if (codemark != null)
                        yield return new TagSpan<CodemarkGlyphTag>(
                            new SnapshotSpan(span.Start - 1, 1),
                            new CodemarkGlyphTag(codemark)
                        );
                }
        }
    }
}