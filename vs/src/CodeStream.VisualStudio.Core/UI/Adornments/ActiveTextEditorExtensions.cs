using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.UI.Adornments {
	public static class ActiveTextEditorExtensions {
		public static HighlightAdornmentManager GetHighlightAdornmentManager(this ActiveTextEditor editor) {
			if (editor == null || editor.WpfTextView == null) return null;

			HighlightAdornmentManager ham = null;
			if (editor.WpfTextView?.Properties.TryGetProperty(PropertyNames.AdornmentManager, out ham) ==
				true) {
				return ham;
			}

			return null;
		}
	}
}
