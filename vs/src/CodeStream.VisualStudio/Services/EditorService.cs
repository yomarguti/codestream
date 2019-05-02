using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.TextManager.Interop;
using Serilog;
using System;
using System.ComponentModel.Composition;
using System.Runtime.InteropServices;
using CodeStream.VisualStudio.UI.Extensions;

namespace CodeStream.VisualStudio.Services {
	[Guid("278C1E14-E429-4364-8B73-BB643C041274")]
	public interface IEditorService {
		EditorState GetActiveEditorState();
		EditorContext GetEditorContext();
		ActiveTextEditorSelection GetActiveTextEditorSelection();
		ActiveTextEditor GetActiveTextEditor(Uri uri = null);
		ActiveTextEditor GetActiveTextEditor(ITextDocumentFactoryService textDocumentFactoryService,
			IWpfTextView wpfTextView);
	}

	[Export(typeof(IEditorService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class EditorService : IEditorService {
		private readonly IServiceProvider _serviceProvider;
		private readonly IComponentModel _componentModel;

		[ImportingConstructor]
		public EditorService(
			[Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) {
			_serviceProvider = serviceProvider;
			_componentModel = serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
			Assumes.Present(_componentModel);
		}

		public ActiveTextEditor GetActiveTextEditor(ITextDocumentFactoryService textDocumentFactoryService, IWpfTextView wpfTextView) {
			try {
				if (textDocumentFactoryService == null || wpfTextView == null) return null;
				if (!textDocumentFactoryService.TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) {
					return null;
				}

				return new ActiveTextEditor(wpfTextView,
					textDocument.FilePath,
					textDocument.FilePath.ToUri(),
					wpfTextView.TextSnapshot.LineCount);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetActiveTextEditor));
			}

			return null;
		}

		public ActiveTextEditor GetActiveTextEditor(Uri uri = null) {
			try {
				IWpfTextView wpfTextView = null;
				if (uri != null) {
					var textViewCache = _componentModel.GetService<IWpfTextViewCache>();
					if (!textViewCache.TryGetValue(uri.ToLocalPath(), out wpfTextView)) {
						// wasn't in cache... try to get it?
						wpfTextView = GetActiveWpfTextView();
					}
				}
				else {
					wpfTextView = GetActiveWpfTextView();
				}

				if (wpfTextView == null) {
					Log.Verbose($"{nameof(wpfTextView)} is null");
					return null;
				}
				;
				if (!_componentModel.GetService<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) {
					return null;
				}

				return new ActiveTextEditor(wpfTextView,
					textDocument.FilePath,
					textDocument.FilePath.ToUri(),
					wpfTextView.TextSnapshot.LineCount);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetActiveTextEditor));
			}

			return null;
		}

		private IWpfTextView GetActiveWpfTextView() {
			try {
				var textView = GetActiveView();
				return textView == null
					? null
					: _componentModel.GetService<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(textView);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetActiveTextEditor));
			}

			return null;
		}

		private IWpfTextView GetActiveWpfTextView(IVsTextView textView) {
			try {
				if (textView == null) return null;

				var editor = _componentModel.GetService<IVsEditorAdaptersFactoryService>();
				return editor.GetWpfTextView(textView);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetActiveTextEditor));
			}

			return null;
		}


		public EditorState GetActiveEditorState() {
			try {
				return GetActiveEditorState(out IVsTextView textView);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(GetActiveEditorState));
			}

			return null;
		}

		private EditorState GetActiveEditorState(out IVsTextView view) {
			try {
				// ReSharper disable once UnusedVariable
				view = GetActiveView();
				return GetActiveEditorState(view);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(GetActiveEditorState));
			}

			view = null;
			return null;
		}

		public EditorState GetActiveEditorState(IVsTextView view) {
			try {
				// view can be null...
				if (view == null) return null;

				view.GetCaretPos(out int piLine, out int piColumn);
				view.GetSelection(out int startLine, out int startColumn, out int endLine, out int endColumn);
				view.GetSelectedText(out string selectedText);

				// end could be before beginning...
				return new EditorState(
					new Range {
						Start = new Position(startLine, startColumn),
						End = new Position(endLine, endColumn)
					}, new Position(piLine, piColumn), selectedText);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(GetActiveEditorState));
			}

			view = null;
			return null;
		}

		private Range GetActiveEditorSelectedRange(out IVsTextView view) {
			try {
				// ReSharper disable once UnusedVariable
				view = GetActiveView();
				if (view == null) {
					return null;
				}

				view.GetSelection(out int startLine, out int startColumn, out int endLine, out int endColumn);
				return new Range {
					Start = new Position(startLine, startColumn),
					End = new Position(endLine, endColumn)
				};
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(GetActiveEditorState));
			}

			view = null;
			return null;
		}

		private ActiveTextEditor ToActiveTextEditor(IWpfTextView wpfTextView, ITextDocument textDocument) {
			return new ActiveTextEditor(wpfTextView,
				textDocument.FilePath,
				textDocument.FilePath.ToUri(),
				wpfTextView.TextSnapshot.LineCount);
		}

		private ActiveTextEditor GetActiveTextEditor(IVsTextView textView) {
			try {
				var wpfTextView = GetActiveWpfTextView(textView);
				if (wpfTextView == null) return null;
				if (!_componentModel.GetService<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) return null;

				return ToActiveTextEditor(wpfTextView, textDocument);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetActiveTextEditor));
			}

			return null;
		}

		private IVsTextView GetActiveView() {
			var textManager = _serviceProvider.GetService(typeof(SVsTextManager)) as IVsTextManager;
			if (textManager == null) return null;

			textManager.GetActiveView(1, null, out IVsTextView textView);
			return textView;
		}

		public EditorContext GetEditorContext() {
			var editorState = GetActiveEditorState(out IVsTextView textView);
			var activeTextEditor = GetActiveTextEditor(textView);

			EditorContext editorContext = null;
			if (activeTextEditor != null) {
				try {
					editorContext = new EditorContext {
						ActiveFile = activeTextEditor.FilePath,
						TextEditorVisibleRanges = activeTextEditor.WpfTextView?.ToVisibleRangesSafe(),
						TextEditorUri = activeTextEditor.Uri?.ToString(),
						TextEditorSelections = editorState.ToEditorSelectionsSafe(),
						TextEditorLineCount = activeTextEditor.TotalLines,
						Metrics = ThemeManager.CreateEditorMetrics(activeTextEditor.WpfTextView),
					};
				}
				catch (Exception ex) {
					Log.Warning(ex, nameof(editorContext));
					editorContext = new EditorContext {
						Metrics = ThemeManager.CreateEditorMetrics()
					};
				}
			}
			else {
				editorContext = new EditorContext {
					Metrics = ThemeManager.CreateEditorMetrics()
				};
			}

			return editorContext;
		}

		public ActiveTextEditorSelection GetActiveTextEditorSelection() {
			try {
				var range = GetActiveEditorSelectedRange(out IVsTextView view);
				if (view == null) return null;

				var wpfTextView = _componentModel.GetService<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(view);
				if (wpfTextView == null) return null;

				if (!_componentModel.GetService<ITextDocumentFactoryService>()
					.TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) return null;

				return new ActiveTextEditorSelection(textDocument.FilePath.ToUri(), range);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(ActiveTextEditorSelection));
			}

			return null;
		}
	}
}
