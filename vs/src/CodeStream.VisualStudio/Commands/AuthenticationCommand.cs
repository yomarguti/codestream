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
		private readonly IServiceProvider _serviceProvider;
		public AuthenticationCommand(AsyncPackage package, IServiceProvider serviceProvider) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.AuthenticationCommandId) {
			_package = package;
			_serviceProvider = serviceProvider;
		}

		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();
			var session = _serviceProvider.GetService(typeof(SSessionService)) as ISessionService;
			if (session?.IsReady == true) {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					var authenticationService = _serviceProvider.GetService(typeof(SAuthenticationService)) as IAuthenticationService;
					if (authenticationService != null) {
						await authenticationService.LogoutAsync();
					}
				});
			}
			else {
				var window = _package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
				if (null == window || (null == window.Frame)) {
					return;
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
			var sessionService = _serviceProvider.GetService(typeof(SSessionService)) as ISessionService;
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
