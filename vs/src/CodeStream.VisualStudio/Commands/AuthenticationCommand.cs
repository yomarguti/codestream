using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Packages;
using CodeStream.VisualStudio.Core.Services;
using CodeStream.VisualStudio.Core.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal class AuthenticationCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationCommand>();

		private readonly IComponentModel _componentModel;

		public AuthenticationCommand(IComponentModel serviceProvider) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.AuthenticationCommandId) {
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
							await authenticationService.LogoutAsync(SessionSignedOutReason.UserSignedOutFromExtension);
						}
					});
				}
				else {
					var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
					toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);
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
					//we don't want to hide this for debugging purposes
#if !DEBUG
					sender.Visible = false;
#endif
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(AuthenticationCommand));
			}
		}
	}

}
