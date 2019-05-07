using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;
using System;
using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal class UserCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<UserCommand>();

		public const string DefaultText = "Sign In...";
		public UserCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.UserCommandId) { }

		public void TriggerChange() {
			OnBeforeQueryStatus(this, null);
		}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			try {
				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var sessionService = componentModel?.GetService<ISessionService>();

				if (sessionService?.IsReady == true) {
					var settingsService = componentModel.GetService<ISettingsService>();
					var env = settingsService?.GetUsefulEnvironmentName();
					var label = env.IsNullOrWhiteSpace()
						? sessionService.User.UserName
						: $"{env}: {sessionService.User.UserName}";
					sender.Text = sessionService.User.HasSingleTeam()
						? label
						: $"{label} - {sessionService.User.TeamName}";

					sender.Visible = true;
					sender.Enabled = true;
				}
				else {
					sender.Visible = false;
					sender.Enabled = false;

					sender.Text = DefaultText;
				}}
			catch (Exception ex) {
				Log.Error(ex, nameof(UserCommand));
			}
		}

		protected override void ExecuteUntyped(object parameter) {
			//noop
		}
	}
}
