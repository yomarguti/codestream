using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.UI.Glyphs
{
    internal class CodemarkGlyphTag : IGlyphTag
    {
        public DocumentMarker Codemark { get; }

        public CodemarkGlyphTag(DocumentMarker codemark)
        {
            Codemark = codemark;
        }
    }
}