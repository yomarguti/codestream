using System;
using System.Threading;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal abstract class AddCodemarkCommandBase : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<AddCodemarkCommandBase>();

		protected AddCodemarkCommandBase(Guid commandSet, int commandId) : base(commandSet, commandId) { }
		protected abstract CodemarkType CodemarkType { get; }

		protected override void ExecuteUntyped(object parameter) {
			try {
				var codeStreamService = (Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel)?.GetService<ICodeStreamService>();
				if (codeStreamService == null || !codeStreamService.IsReady) return;

				var componentModel = (IComponentModel)Package.GetGlobalService(typeof(SComponentModel));
				var editorService = componentModel.GetService<IEditorService>();
				var activeTextEditor = editorService.GetActiveTextEditorSelection();
				if (activeTextEditor == null) return;

				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					try {
						var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
						toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);
						string source = null;
						if (CommandSet == PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet) {
							source = "Context Menu";
						}
						else if (CommandSet == PackageGuids.guidWebViewPackageShortcutCmdSet) {
							source = "Shortcut";
						}
						await codeStreamService.NewCodemarkAsync(activeTextEditor.Uri, activeTextEditor.Range,
							CodemarkType, source,
							cancellationToken: CancellationToken.None);
					}
					catch (Exception ex) {
						Log.Error(ex, "NewCodemarkAsync");
					}
				});
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(AddCodemarkCommandBase));
			}
		}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			var session = (Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel)?.GetService<ISessionService>();

			sender.Visible = session?.IsReady == true;
		}
	}
}
