using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using Serilog;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal class AddCodemarkCommentCommand : AddCodemarkCommandBase {
		public AddCodemarkCommentCommand() : base(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkCommentCommandId) { }
		protected override CodemarkType CodemarkType => CodemarkType.Comment;
	}

	internal class AddCodemarkIssueCommand : AddCodemarkCommandBase {
		public AddCodemarkIssueCommand() : base(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkIssueCommandId) { }
		protected override CodemarkType CodemarkType => CodemarkType.Issue;
	}

	internal class AddCodemarkBookmarkCommand : AddCodemarkCommandBase {
		public AddCodemarkBookmarkCommand() : base(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkBookmarkCommandId) { }
		protected override CodemarkType CodemarkType => CodemarkType.Bookmark;
	}

	internal class AddCodemarkPermalinkCommand : AddCodemarkCommandBase {
		public AddCodemarkPermalinkCommand() : base(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkPermalinkCommandId) { }
		protected override CodemarkType CodemarkType => CodemarkType.Link;
	}

	internal class AddCodemarkPermalinkInstantCommand : AddCodemarkCommandBase {
		public AddCodemarkPermalinkInstantCommand() : base(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkPermalinkInstantCommandId) { }

		private static readonly ILogger Log = LogManager.ForContext<AddCodemarkPermalinkInstantCommand>();
		protected override CodemarkType CodemarkType => CodemarkType.Link;

		protected override void ExecuteUntyped(object parameter) {
			var agentService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SCodeStreamAgentService))) as ICodeStreamAgentService;
			if (agentService == null) return;

			var ideService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SIdeService))) as IdeService;
			if (ideService == null) return;

			var selectedText = ideService.GetActiveEditorState(out IVsTextView view);
			if (view == null) return;

			var componentModel = (IComponentModel)(Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SComponentModel)));
			var exports = componentModel.DefaultExportProvider;

			var wpfTextView = exports.GetExportedValue<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(view);
			if (wpfTextView == null) return;

			if (!exports.GetExportedValue<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) return;

			ThreadHelper.JoinableTaskFactory.Run(async delegate {
				try {
					var response = await agentService.CreatePermalinkAsync(selectedText.Range, textDocument.FilePath.ToUri().ToString(),
						"private");
					if (response != null) {
						await ideService.SetClipboardAsync(response.LinkUrl);
						//InfoBarProvider.Instance.ShowInfoBar($"Copied {foo.LinkUrl} to your clipboard");
					}
				}
				catch (Exception ex) {
					Log.Warning(ex, nameof(ExecuteUntyped));
				}
			});
		}
		 
	}
}
