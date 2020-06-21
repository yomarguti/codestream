using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Packages;
using CodeStream.VisualStudio.Core.Services;
using CodeStream.VisualStudio.Core.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Threading;

namespace CodeStream.VisualStudio.Commands {
	public class StartWorkCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<StartWorkCommand>();

		public StartWorkCommand() : base(PackageGuids.guidWebViewPackageShortcutCmdSet, PackageIds.StartWorkCommandId) { }
		protected override void ExecuteUntyped(object parameter) {
			try {
				var codeStreamService = (Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel)?.GetService<ICodeStreamService>();
				if (codeStreamService == null || !codeStreamService.IsReady) return;

				var componentModel = (IComponentModel)Package.GetGlobalService(typeof(SComponentModel));
				bool requiredActivation = false;
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

					try {
						var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
						if (!toolWindowProvider.IsVisible(Guids.WebViewToolWindowGuid)) {
							if (toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid) == true) {
								requiredActivation = true;
							}
							else {
								Log.Warning("Could not activate tool window");
							}
						}
					}
					catch (Exception ex) {
						Log.Error(ex, nameof(StartWorkCommand));
					}
				});

				var sessionService = componentModel.GetService<ISessionService>();

				try {
					_ = System.Threading.Tasks.Task.Factory.StartNew(async delegate {
						if (requiredActivation) {
							await System.Threading.Tasks.Task.Delay(1200);
						}
						await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
						try {
							string source = null;
							if (CommandSet == PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet) {
								source = "Context Menu";
							}
							else if (CommandSet == PackageGuids.guidWebViewPackageShortcutCmdSet) {
								source = "Shortcut";
							}
							var editorService = componentModel.GetService<IEditorService>();
							var activeTextEditor = editorService.GetActiveTextEditorSelection();

							await codeStreamService.StartWorkAsync(source, activeTextEditor?.Uri,
								cancellationToken: CancellationToken.None);
						}
						catch (Exception ex) {
							Log.Warning(ex, nameof(ExecuteUntyped));
						}
						return 42;
					});
				}
				catch (Exception ex) {
					Log.Error(ex, "StartWorkAsync");
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(StartWorkCommand));
			}
		}
	}
}
