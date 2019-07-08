using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;
using System;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal class UserCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<UserCommand>();

		private const string DefaultText = "Sign In...";
		private readonly ISessionService _sessionService;
		private readonly ISettingsManager _settingsManager;

		private static bool DefaultVisibility = false;

		public UserCommand(ISessionService sessionService, ISettingsManager settingManager) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.UserCommandId) {
			_sessionService = sessionService;
			_settingsManager = settingManager;

#if DEBUG
			// make this visible in DEUBG so we can see the Developer tools command
			DefaultVisibility = true;
#endif
			Visible = DefaultVisibility;
			Enabled = DefaultVisibility;
			Text = DefaultText;
		}

		public void Update() {
			ThreadHelper.ThrowIfNotOnUIThread();
			try {
				switch (_sessionService.SessionState) {
					case SessionState.UserSignInFailed: {
							// the caching on this sucks and it doesn't always update...
							//Visible = false;
							//Enabled = false;
							//Text = DefaultText;							
							break;
						}
					case SessionState.UserSigningIn:
					case SessionState.UserSigningOut: {
							// the caching on this sucks and it doesn't always update...
							//if (!_sessionService.IsReady) {
							//	Text = "Loading...";
							//	Visible = false;
							//	Enabled = false;
							//}							
							break;
						}
					case SessionState.UserSignedIn: {
							var user = _sessionService.User;
							var env = _settingsManager?.GetUsefulEnvironmentName();
							var label = env.IsNullOrWhiteSpace() ? user.UserName : $"{env}: {user.UserName}";
							
							Visible = true;
							Enabled = true;
							Text = user.HasSingleTeam() ? label : $"{label} - {user.TeamName}";
							break;
						}
					default: {
							Visible = false;
							Enabled = false;
							Text = DefaultText;
							break;
						}
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(UserCommand));
			}
		}

		protected override void ExecuteUntyped(object parameter) {
			//noop
		}
	}
}
