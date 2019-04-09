using CodeStream.VisualStudio.UI;
using CodeStream.VisualStudio.UI.Adornments;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text.Editor;
using System;

namespace CodeStream.VisualStudio.Models {
	public class ActiveTextEditor : ICanHighlightRange, ICanSelectRange {
		public ActiveTextEditor(IWpfTextView textView, string filePath, Uri uri, int? totalLines) {
			TextView = textView;
			FilePath = filePath;
			Uri = uri;
			TotalLines = totalLines;
		}

		public IWpfTextView TextView { get; }
		public string FilePath { get; }
		public Uri Uri { get; }
		public int? TotalLines { get; }

		public bool Highlight(Range range, bool highlight) {
			var adornmentManager = this.GetHighlightAdornmentManager();

			if (adornmentManager == null) return false;

			return adornmentManager.Highlight(range, highlight);
		}

		public bool SelectRange(Range range) {
			var adornmentManager = this.GetHighlightAdornmentManager();

			if (adornmentManager == null) return false;

			return adornmentManager.Highlight(range, true);
			//foreach (var line in this.TextView.TextViewLines) {
			//	// GetLineNumberFromPosition is 0-based
			//	var lineNumber = this.TextView.TextSnapshot.GetLineNumberFromPosition(line.Extent.Start.Position);
			//	if (range.Start.Line == lineNumber) {
			//		this.TextView.Selection.Select(line.Snapshot.)
			//	}


			//}


			//if (adornmentManager == null) return false;

			//return adornmentManager.Highlight(range, false);
		}
	}
}
