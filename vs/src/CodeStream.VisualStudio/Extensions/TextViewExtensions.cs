using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;
using System;
using System.Linq;
using CodeStream.VisualStudio.UI;

namespace CodeStream.VisualStudio.Extensions {
	public static class TextViewExtensions {

		public static bool HasValidRoles(this IWpfTextView wpfTextView) => wpfTextView.Roles.HasValidRoles();

		public static bool HasValidRoles(this ITextViewRoleSet roles) {
			return roles.ContainsAll(TextViewRoles.DefaultRoles) &&
			       roles.Intersect(TextViewRoles.InvalidRoles).Any() == false;
		}
		
		public static Tuple<ITextSnapshotLine, ITextSnapshotLine> GetLinesFromRange(this IWpfTextView wpfTextView, int start, int end) {
			ITextSnapshotLine startLine = null;
			ITextSnapshotLine endLine = null;
			try {
				foreach (var line in wpfTextView.VisualSnapshot.Lines) {
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

		/// <summary>
		/// Converts a Range's start and end lines/characters into a Span, which is consumable by an ITextView
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="range"></param>
		/// <returns></returns>
		public static Span? ToSpan(this IWpfTextView wpfTextView, Range range) {
			var sp1 = new SnapshotPoint();
			var sp2 = new SnapshotPoint();
			try {
				foreach (var line in wpfTextView.VisualSnapshot.Lines) {
					// GetLineNumberFromPosition is 0-based
					var lineNumber = wpfTextView.TextSnapshot.GetLineNumberFromPosition(line.Extent.Start.Position);
					if (range.Start.Line == lineNumber) {
						sp1 = new SnapshotPoint(line.Snapshot, line.MinStartCharacter(range));
					}
					if (range.End.Line == lineNumber) {
						sp2 = new SnapshotPoint(line.Snapshot, line.MaxEndCharacter(range));
					}
				}
				var span = new Span(sp1.Position, Math.Abs(sp1.Difference(sp2)));
				return span;
			}
			catch { }

			return null;
		}

		public static int MinStartCharacter(this ITextSnapshotLine line, Range range) {
			var position = line.Start.Position + range.Start.Character;
			if (position > line.Extent.End.Position) {
				position = line.Start.Position;
			}

			return position;
		}

		public static int MaxEndCharacter(this ITextSnapshotLine line, Range range) {
			var position = line.Start.Position + range.End.Character;
			if (position > line.Extent.End.Position) {
				position = line.Extent.End.Position;
			}

			return position;
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

		public static ITextDocument GetDocument(this IWpfTextView wpfTextView) {
			return GetDocument(wpfTextView?.TextBuffer);
		}

		public static ITextDocument GetDocument(this ITextBuffer textBuffer) {
			if (textBuffer == null) return null;
			ITextDocument textDoc;
			var rc = textBuffer.Properties.TryGetProperty<ITextDocument>(typeof(ITextDocument), out textDoc);
			if (rc == true)
				return textDoc;
			else
				return null;
		}
	}
}
