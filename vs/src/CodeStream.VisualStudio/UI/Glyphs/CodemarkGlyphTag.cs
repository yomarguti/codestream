using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.UI.Glyphs
{
    internal class CodemarkGlyphTag : IGlyphTag
    {
        public CsFullMarker Codemark { get; }

        public CodemarkGlyphTag(CsFullMarker codemark)
        {
            Codemark = codemark;
        }
    }
}