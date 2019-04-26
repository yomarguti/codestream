using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal class AuthenticationCommand : VsCommandBase {
		private readonly AsyncPackage _package;
		public AuthenticationCommand(AsyncPackage package) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.AuthenticationCommandId) {
			_package = package;
		}

		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();

			var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
			if (session?.IsReady == true) {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
					if (codeStreamService != null) {
						await codeStreamService.LogoutAsync();
					}
				});
			}
			else {
				var window = _package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
				if ((null == window) || (null == window.Frame)) {
					throw new NotSupportedException("Cannot create tool window");
				}
				var windowFrame = (IVsWindowFrame)window.Frame;
				if (windowFrame.IsVisible() == VSConstants.S_OK) {
					// already visible!
				}
				else {
					ErrorHandler.ThrowOnFailure(windowFrame.Show());
				}
			}
		}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			var sessionService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
			var isReady = sessionService?.IsReady == true;
			if (isReady) {
				sender.Visible = true;
				sender.Text = "Sign Out";
			}
			else {
				sender.Visible = false;
			}
		}
	}
}
