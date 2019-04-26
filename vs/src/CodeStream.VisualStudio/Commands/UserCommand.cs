using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal class UserCommand : VsCommandBase {
		public const string DefaultText = "Sign In...";
		public UserCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.UserCommandId) { }

		public void TriggerChange() {
			OnBeforeQueryStatus(this, null);
		}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			var sessionService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
			if (sessionService?.IsReady == true) {
				var settingsService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
				var env = settingsService?.GetUsefulEnvironmentName();
				var label = env.IsNullOrWhiteSpace() ? sessionService.User.UserName : $"{env}: {sessionService.User.UserName}";
				sender.Text = sessionService.User.HasSingleTeam() ? label : $"{label} - {sessionService.User.TeamName}";

				sender.Visible = true;
				sender.Enabled = true;
			}
			else {
				sender.Visible = false;
				sender.Enabled = false;

				sender.Text = DefaultText;
			}
		}

		protected override void ExecuteUntyped(object parameter) {
			//noop
		}
	}
}
