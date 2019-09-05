using System;
using System.Linq;
using System.Text;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.UI;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;

namespace CodeStream.VisualStudio.Core.Extensions {
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
			SnapshotPoint? sp1 = null;
			SnapshotPoint? sp2 = null;
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
					if (sp1 != null && sp2 != null) {
						break;
					}
				}
				if (sp1 == null || sp2 == null) return null;

				var span = new Span(sp1.Value.Position, Math.Abs(sp1.Value.Difference(sp2.Value)));
				return span;
			}
			catch { }

			return null;
		}

		/// <summary>
		/// Creates a single lengthed Span based on starting line
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="startLine"></param>
		/// <param name="startPosition">optional</param>
		/// <returns></returns>
		public static Span? ToStartLineSpan(this IWpfTextView wpfTextView, int startLine, int? startPosition = null) {
			SnapshotPoint? sp = null;
			try {
				foreach (var line in wpfTextView.VisualSnapshot.Lines) {
					// GetLineNumberFromPosition is 0-based					
					if (startLine == wpfTextView.TextSnapshot.GetLineNumberFromPosition(line.Extent.Start.Position)) {
						sp = new SnapshotPoint(line.Snapshot, startPosition.HasValue ? line.MinStartCharacter(startPosition.Value) : line.Start.Position);
						break;
					}
				}
				if (sp == null) return null;

				return new Span(sp.Value.Position, 1);
			}
			catch { }

			return null;
		}

		public static int MinStartCharacter(this ITextSnapshotLine line, Range range) {
			return line.MinStartCharacter(range.Start.Character);
		}

		public static int MinStartCharacter(this ITextSnapshotLine line, int startCharacter) {
			var position = line.Start.Position + startCharacter;
			if (position > line.Extent.End.Position) {
				position = line.Start.Position;
			}

			return position;
		}

		public static int MaxEndCharacter(this ITextSnapshotLine line, Range range) {
			if (range.End.Character == int.MaxValue) {
				return line.Extent.End.Position;
			}
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

		/// <summary>
		/// Creates a Range object from a wpfTextView.Selection
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="range"></param>
		/// <returns></returns>
		public static bool TryCreateSelectionRange(this IWpfTextView wpfTextView, out Range range) {
			if (!wpfTextView.Selection.IsEmpty) {
				range = new Range();

				var lineStart = wpfTextView.TextSnapshot.GetLineFromPosition(wpfTextView.Selection.Start.Position);
				var characterStart = wpfTextView.Selection.Start.Position - lineStart.Extent.Start.Position;
				range.Start = new Position(lineStart.LineNumber, characterStart);

				var lineEnd = wpfTextView.TextSnapshot.GetLineFromPosition(wpfTextView.Selection.End.Position);
				var characterEnd = wpfTextView.Selection.End.Position - lineEnd.Extent.Start.Position;
				range.End = new Position(lineEnd.LineNumber, characterEnd);
				return true;
			}
			else {
				range = new Range().AsEmpty();
				return false;
			}
		}

		/// <summary>
		/// Creates a Position object from a wpfTextView.Caret
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="position"></param>
		/// <returns></returns>
		public static bool TryCreateCaretPosition(this IWpfTextView wpfTextView, out Position position) {
			int caretLine = 0;
			var caretCol = 0;
			if (wpfTextView.Caret != null) {
				var line = wpfTextView.TextSnapshot.GetLineFromPosition(wpfTextView.Caret.Position.BufferPosition);
				if (line != null) {
					caretLine = line.LineNumber;
					caretCol = wpfTextView.Caret.Position.BufferPosition.Position - line.Extent.Start.Position;
				}
				position = new Position(caretLine, caretCol);
				return true;
			}
			else {
				position = new Position(caretLine, caretCol);
				return false;
			}
		}

		public static EditorState GetEditorState(this IWpfTextView wpfTextView) {
			string selectedText = null;
			if (TryCreateSelectionRange(wpfTextView, out Range selectionRange)) {
				selectedText = GetText(wpfTextView.Selection);
			}

			TryCreateCaretPosition(wpfTextView, out Position caretPosition);

			System.Diagnostics.Debug.WriteLine($"Range Start={selectionRange.Start.Line},{selectionRange.Start.Character} End={selectionRange.End.Line},{selectionRange.End.Character} Caret={caretPosition.Line},{caretPosition.Character} HasSelected={!wpfTextView.Selection.IsEmpty}");
			return new EditorState(selectionRange, caretPosition, selectedText);
		}

		public static bool HasEditorSelection(this IWpfTextView wpfTextView) {
			return wpfTextView.Selection != null && wpfTextView.Selection.IsEmpty == false;
		}

		/// <summary>
		/// Gets the text from a Selection
		/// </summary>
		/// <param name="textSelection"></param>
		/// <returns></returns>
		/// <remarks>Thanks dnSpy!</remarks>
		private static string GetText(ITextSelection textSelection) {
			if (textSelection.Mode == TextSelectionMode.Stream)
				return textSelection.StreamSelectionSpan.GetText();
			var sb = new StringBuilder();
			var snapshot = textSelection.TextView.TextSnapshot;
			int i = 0;
			foreach (var s in textSelection.SelectedSpans) {
				if (i++ > 0)
					sb.AppendLine();
				sb.Append(snapshot.GetText(s));
			}
			if (i > 1)
				sb.AppendLine();
			return sb.ToString();
		}
	}
}
