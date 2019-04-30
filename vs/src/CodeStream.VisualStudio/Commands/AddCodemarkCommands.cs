using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Threading;

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
			try {
				var agentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
				if (agentService == null) return;

				var componentModel = (IComponentModel) Package.GetGlobalService(typeof(SComponentModel));
				var editorService = componentModel.GetService<IEditorService>();
				var activeTextEditor = editorService.GetActiveTextEditorSelection();
				if (activeTextEditor == null) return;

				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					try {
						var response = await agentService.CreatePermalinkAsync(activeTextEditor.Range, activeTextEditor.Uri.ToString(),
							"private");
						
						if (response != null) {
							var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
							if (ideService != null) {
								await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
								await ideService.SetClipboardAsync(response.LinkUrl);
							}
							//InfoBarProvider.Instance.ShowInfoBar($"Copied {foo.LinkUrl} to your clipboard");
						}
					}
					catch (Exception ex) {
						Log.Warning(ex, nameof(ExecuteUntyped));
					}
				});
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(AddCodemarkPermalinkInstantCommand));
			}
		}
	}
}
