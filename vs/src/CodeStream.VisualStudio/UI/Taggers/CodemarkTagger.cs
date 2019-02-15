using System;
using System.Collections.Generic;
using System.Linq;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Glyphs;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Serilog;

namespace CodeStream.VisualStudio.UI.Taggers
{
    /// <summary>
    ///     Responsible for matching Codemarks up to a line
    /// </summary>
    internal class CodemarkTagger : ITagger<CodemarkGlyphTag>
    {
        private static readonly ILogger Log = LogManager.ForContext<CodemarkTaggerProvider>();
        
        private readonly ITextView _textView;
        private readonly ITextDocument _textDocument;
        private readonly ITextBuffer _buffer;

        public CodemarkTagger(ITextView textView, ITextDocument textDocument, ITextBuffer buffer)
        {
            Log.Verbose("ctor");

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
            List<DocumentMarker> markers = null;
            if (_textDocument.TextBuffer.Properties.ContainsProperty(PropertyNames.CodemarkMarkers))
                markers = _textDocument.TextBuffer.Properties.GetProperty<List<DocumentMarker>>(PropertyNames.CodemarkMarkers);

            if (markers == null || !markers.AnySafe()) yield break;

            foreach (var span in spans)
            {
                var lineNumber = span.Start.GetContainingLine().LineNumber;
                var codemark = markers.FirstOrDefault(_ => _?.Range?.Start.Line == lineNumber);
                if (codemark == null) continue;

                SnapshotPoint start = span.Start == 0 ? span.Start : span.Start - 1;
                yield return new TagSpan<CodemarkGlyphTag>(
                    new SnapshotSpan(start, 1),
                    new CodemarkGlyphTag(codemark)
                );
            }
        }
    }
}