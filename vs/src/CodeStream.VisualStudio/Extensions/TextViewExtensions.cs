using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;
using System;

namespace CodeStream.VisualStudio.Extensions {
	public static class TextViewExtensions {
		public static Tuple<ITextViewLine, ITextViewLine> GetLinesFromRange(this IWpfTextView wpfTextView, Range range) {
			return wpfTextView.GetLinesFromRange(range.Start.Line, range.End.Line);
		}

		public static Tuple<ITextViewLine, ITextViewLine> GetLinesFromRange(this IWpfTextView wpfTextView, int start, int end) {
			ITextViewLine startLine = null;
			ITextViewLine endLine = null;
			try {
				foreach (var line in wpfTextView.TextViewLines) {
					// GetLineNumberFromPosition is 0-based
					var lineNumber = wpfTextView.TextSnapshot.GetLineNumberFromPosition(line.Extent.Start.Position);
					if (start == lineNumber) {
						startLine = line;
					}
					if (end == lineNumber) {
						endLine = line;
					}
				}
				if (startLine != null && endLine != null) {
					return Tuple.Create(startLine, endLine);
				}
			}
			catch { }

			return null;
		}

		public static ITextViewLine GetLine(this IWpfTextView wpfTextView, Position position) {
			return wpfTextView.GetLine(position.Line);
		}

		public static ITextViewLine GetLine(this IWpfTextView wpfTextView, int lineNumber) {
			try {
				foreach (var l in wpfTextView.TextViewLines) {
					// GetLineNumberFromPosition is 0-based					
					if (lineNumber == wpfTextView.TextSnapshot.GetLineNumberFromPosition(l.Extent.Start.Position)) {
						return l;
					}
				}
			}
			catch { }

			return null;
		}
	}
}
