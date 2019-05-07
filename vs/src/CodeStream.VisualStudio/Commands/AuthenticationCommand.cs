using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;
using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal class AuthenticationCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationCommand>();

		private readonly AsyncPackage _package;
		private readonly IComponentModel _componentModel;

		public AuthenticationCommand(AsyncPackage package, IComponentModel serviceProvider) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.AuthenticationCommandId) {
			_package = package;
			_componentModel = serviceProvider;
		}

		protected override void ExecuteUntyped(object parameter) {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();
				var session = _componentModel.GetService<ISessionService>();
				if (session?.IsReady == true) {
					ThreadHelper.JoinableTaskFactory.Run(async delegate {
						await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
						var authenticationService = _componentModel.GetService<IAuthenticationService>();
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
			catch (Exception ex) {
				Log.Error(ex, nameof(AuthenticationCommand));
			}
		}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			try {
				var sessionService = _componentModel.GetService<ISessionService>();
				var isReady = sessionService?.IsReady == true;
				if (isReady) {
					sender.Visible = true;
					sender.Text = "Sign Out";
				}
				else {
					sender.Visible = false;
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(AuthenticationCommand));
			}
		}
	}
}
