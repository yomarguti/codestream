using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Packages;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal sealed class WebViewToggleCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<WebViewToggleCommand>();
		public WebViewToggleCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewToggleCommandId) { }

		protected override void ExecuteUntyped(object parameter) {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();

				var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
				var result = toolWindowProvider?.ToggleToolWindowVisibility(Guids.WebViewToolWindowGuid);

				if (result.HasValue) {
					var codeStreamAgentService = (Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel)?.GetService<ICodeStreamAgentService>();
					codeStreamAgentService?.TrackAsync(result.Value
						? TelemetryEventNames.WebviewOpened
						: TelemetryEventNames.WebviewClosed);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(WebViewToggleCommand));
			}
		}
	}
}
