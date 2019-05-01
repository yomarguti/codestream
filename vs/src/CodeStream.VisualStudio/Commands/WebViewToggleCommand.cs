using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal sealed class WebViewToggleCommand : VsCommandBase {
		private AsyncPackage _package;
		public WebViewToggleCommand(AsyncPackage package) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewToggleCommandId) {
			_package = package;
		}

		private IVsWindowFrame GetWindowFrame() {
			ThreadHelper.ThrowIfNotOnUIThread();
			// Get the instance number 0 of this tool window. This window is single instance so this instance
			// is actually the only one.
			// The last flag is set to true so that if the tool window does not exists it will be created.
			var window = _package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
			if ((null == window) || (null == window.Frame)) {
				throw new NotSupportedException("Cannot create tool window");
			}

			IVsWindowFrame windowFrame = (IVsWindowFrame)window.Frame;
			return windowFrame;
		}

		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();
			var isVisible = false;
			IVsWindowFrame windowFrame = GetWindowFrame();
			if (windowFrame.IsVisible() == VSConstants.S_OK) {
				windowFrame.Hide();
			}
			else {
				windowFrame.Show();
				isVisible = true;
			}

			var codeStreamAgentService = ServiceLocator.Get<SCodeStreamAgentService, ICodeStreamAgentService>();
			codeStreamAgentService?.TrackAsync(isVisible ? TelemetryEventNames.WebviewOpened : TelemetryEventNames.WebviewClosed);
		}
	}
}
