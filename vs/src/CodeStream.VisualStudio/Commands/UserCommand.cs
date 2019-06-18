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
		private readonly ISettingsManager _settingsManager;

		public UserCommand(ISettingsManager settingManager) : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.UserCommandId) {
			_settingsManager = settingManager;

			Visible = false;
			Enabled = false;

			Text = DefaultText;
		}

		public void TriggerChange(bool isSessionReady) {
			ThreadHelper.ThrowIfNotOnUIThread();
			try {				
				if (isSessionReady == true) {
					var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
					var sessionService = componentModel?.GetService<ISessionService>();

					var env = _settingsManager?.GetUsefulEnvironmentName();
					var label = env.IsNullOrWhiteSpace()
						? sessionService.User.UserName
						: $"{env}: {sessionService.User.UserName}";
					Text = sessionService.User.HasSingleTeam()
						? label
						: $"{label} - {sessionService.User.TeamName}";

					Visible = true;
					Enabled = true;
				}
				else {
					Visible = false;
					Enabled = false;

					Text = DefaultText;
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
