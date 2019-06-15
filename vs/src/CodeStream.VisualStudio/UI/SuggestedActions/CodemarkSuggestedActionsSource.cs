using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.UI.SuggestedActions {
	internal class CodemarkSuggestedActionsSource : ISuggestedActionsSource {
		private static readonly ILogger Log = LogManager.ForContext<CodemarkSuggestedActionsSource>();

		private readonly IComponentModel _componentModel;
		private readonly ITextBuffer _textBuffer;
		private readonly ITextView _textView;
		private readonly ITextDocument _textDocument;

		public CodemarkSuggestedActionsSource(IComponentModel componentModel,
			ITextView textView,
			ITextBuffer textBuffer,
			ITextDocument textDocument) {
			_componentModel = componentModel;
			_textBuffer = textBuffer;
			_textView = textView;
			_textDocument = textDocument;
		}

		public bool TryGetTelemetryId(out Guid telemetryId) {
			telemetryId = Guid.Empty;
			return false;
		}

#pragma warning disable 0067
		public event EventHandler<EventArgs> SuggestedActionsChanged;
#pragma warning restore 0067

		private EditorState _textSelection;

		public IEnumerable<SuggestedActionSet> GetSuggestedActions(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken) {
			try {
				if (_textSelection?.HasSelectedText == false) {
					Log.Verbose($"{nameof(GetSuggestedActions)} Empty HasText={_textSelection?.HasSelectedText}");
					return Enumerable.Empty<SuggestedActionSet>();
				}

				return new[] {
					new SuggestedActionSet(
						actions: new ISuggestedAction[] {
							new CodemarkCommentSuggestedAction(_componentModel, _textDocument, _textSelection),
							new CodemarkIssueSuggestedAction(_componentModel, _textDocument, _textSelection),
							new CodemarkBookmarkSuggestedAction(_componentModel, _textDocument, _textSelection),
							new CodemarkPermalinkSuggestedAction(_componentModel, _textDocument, _textSelection)
						},
						categoryName: null,
						title: null,
						priority: SuggestedActionSetPriority.None,
						applicableToSpan: null
					)
				};
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(GetSuggestedActions));
			}

			return Enumerable.Empty<SuggestedActionSet>();
		}

		public Task<bool> HasSuggestedActionsAsync(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken) {
			try {
				var sessionService = _componentModel.GetService<ISessionService>();
				if (sessionService == null || sessionService.IsReady == false) return System.Threading.Tasks.Task.FromResult(false);
				
				var wpfTextView = _textView as IWpfTextView;
				if (wpfTextView == null) return System.Threading.Tasks.Task.FromResult(false);
				
				_textSelection = wpfTextView.GetEditorState();
				return System.Threading.Tasks.Task.FromResult(_textSelection?.HasSelectedText == true);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(HasSuggestedActionsAsync));
				return System.Threading.Tasks.Task.FromResult(false);
			}
		}

		public void Dispose() {
			Log.Verbose($"{nameof(CodemarkSuggestedActionsSource)} disposed");
		}
	}

	internal class CodemarkCommentSuggestedAction : CodemarkSuggestedActionBase {
		public CodemarkCommentSuggestedAction(IComponentModel componentModel, ITextDocument textDocument, EditorState textSelection) : base(componentModel, textDocument, textSelection) { }
		protected override CodemarkType CodemarkType => CodemarkType.Comment;
		public override string DisplayText { get; } = $"Add Comment";
	}

	internal class CodemarkIssueSuggestedAction : CodemarkSuggestedActionBase {
		public CodemarkIssueSuggestedAction(IComponentModel componentModel, ITextDocument textDocument, EditorState textSelection) : base(componentModel, textDocument, textSelection) { }
		protected override CodemarkType CodemarkType => CodemarkType.Issue;
		public override string DisplayText { get; } = $"Create Issue";
	}

	internal class CodemarkBookmarkSuggestedAction : CodemarkSuggestedActionBase {
		public CodemarkBookmarkSuggestedAction(IComponentModel componentModel, ITextDocument textDocument, EditorState textSelection) : base(componentModel, textDocument, textSelection) { }
		protected override CodemarkType CodemarkType => CodemarkType.Bookmark;
		public override string DisplayText { get; } = $"Create Bookmark";
	}

	internal class CodemarkPermalinkSuggestedAction : CodemarkSuggestedActionBase {
		public CodemarkPermalinkSuggestedAction(IComponentModel componentModel, ITextDocument textDocument, EditorState textSelection) : base(componentModel, textDocument, textSelection) { }
		protected override CodemarkType CodemarkType => CodemarkType.Link;
		public override string DisplayText { get; } = $"Get Permalink";
	}

	internal abstract class CodemarkSuggestedActionBase : ISuggestedAction {
		private static readonly ILogger Log = LogManager.ForContext<CodemarkSuggestedActionBase>();

		private readonly EditorState _textSelection;
		private readonly ITextDocument _textDocument;
		protected IComponentModel ComponentModel { get; private set; }
		protected abstract CodemarkType CodemarkType { get; }

		protected CodemarkSuggestedActionBase(IComponentModel componentModel, ITextDocument textDocument, EditorState textSelection) {
			ComponentModel = componentModel;
			_textDocument = textDocument;
			_textSelection = textSelection;
		}

		public Task<IEnumerable<SuggestedActionSet>> GetActionSetsAsync(CancellationToken cancellationToken) {
			return System.Threading.Tasks.Task.FromResult<IEnumerable<SuggestedActionSet>>(null);
		}

		public void Invoke(CancellationToken cancellationToken) {
			if (_textDocument == null) return;

			var codeStreamService = ComponentModel?.GetService<ICodeStreamService>();
			if (codeStreamService == null) return;

			ThreadHelper.JoinableTaskFactory.Run(async delegate {
				try {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
					toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);

					_ = codeStreamService.NewCodemarkAsync(_textDocument.FilePath.ToUri(), _textSelection.Range, CodemarkType, "Lightbulb Menu", cancellationToken: cancellationToken);
				}
				catch (Exception ex) {
					Log.Error(ex, nameof(CodemarkSuggestedActionBase));
				}
			});
		}

		public Task<object> GetPreviewAsync(CancellationToken cancellationToken) {
			// nothing here, but here is an example:

			//var textBlock = new TextBlock
			//{
			//    Padding = new Thickness(5)
			//};
			//textBlock.Inlines.Add(new Run() { Text = _selectedText.Text });

			return System.Threading.Tasks.Task.FromResult<object>(null);
		}

		public bool TryGetTelemetryId(out Guid telemetryId) {
			// This is a sample action and doesn't participate in LightBulb telemetry  
			telemetryId = Guid.Empty;
			return false;
		}

		public bool HasActionSets => false;

		public abstract string DisplayText { get; }

		public ImageMoniker IconMoniker => default(ImageMoniker);

		public string IconAutomationText => null;

		public string InputGestureText => null;

		public bool HasPreview => false;

		public void Dispose() {
		}
	}
}
