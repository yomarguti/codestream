using System.Windows;
using CodeStream.VisualStudio.UI.Margins;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;

namespace CodeStream.VisualStudio.UI.Glyphs
{
    internal class CodemarkGlyphFactory : IGlyphFactory
    {
        /// <summary>
        /// Creates a WPF Codemark
        /// </summary>
        /// <param name="line"></param>
        /// <param name="tag"></param>
        /// <returns></returns>
        public UIElement GenerateGlyph(IWpfTextViewLine line, IGlyphTag tag)
        {
            if (tag == null) return null;

            // Ensure we can draw a glyph for this marker.
            var codemark = tag as CodemarkGlyphTag;

            if (codemark == null) return null;
            
            return new Codemark(new CodemarkViewModel(codemark.Codemark));
        }
    }
}