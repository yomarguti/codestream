using System.Windows;
using CodeStream.VisualStudio.UI.Margins;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;

namespace CodeStream.VisualStudio.UI.Glyphs {
	internal class DocumentMarkGlyphFactory : IGlyphFactory {
		/// <summary>
		/// Creates a WPF Codemark
		/// </summary>
		/// <param name="line"></param>
		/// <param name="tag"></param>
		/// <returns></returns>
		public UIElement GenerateGlyph(IWpfTextViewLine line, IGlyphTag tag) {
			if (tag == null) return null;

			// Ensure we can draw a glyph for this marker.
			var documentMarkGlyphTag = tag as DocumentMarkGlyphTag;

			if (documentMarkGlyphTag == null ||
				documentMarkGlyphTag.DocumentMarker == null ||
				documentMarkGlyphTag.DocumentMarker.Codemark == null) return null;

			return new DocumentMark(new DocumentMarkViewModel(documentMarkGlyphTag.DocumentMarker));
		}
	}
}
