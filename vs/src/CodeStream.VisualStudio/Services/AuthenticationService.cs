using CodeStream.VisualStudio.Core.Logging;
using Serilog;
using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;

namespace CodeStream.VisualStudio.Services {

	[Export(typeof(IAuthenticationService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class AuthenticationService : IAuthenticationService {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationService>();

		[Import]
		public ISessionService SessionService { get; set; }
		[Import]
		public IEventAggregator EventAggregator { get; set; }
		[Import]
		public ICredentialsService CredentialsService { get; set; }
		[Import]
		public ICodeStreamAgentService CodeStreamAgentService { get; set; }
		[Import]
		public IBrowserService WebviewIpc { get; set; }
		[Import]
		public ISettingsServiceFactory SettingsServiceFactory { get; set; }

		public async System.Threading.Tasks.Task LogoutAsync() {
			Log.Information($"{nameof(LogoutAsync)} starting");
			try {
				try {
					SessionService.SetState(SessionState.UserSigningOut);
				}
				catch(Exception ex) {
					Log.Warning(ex, $"{nameof(LogoutAsync)} - SetState");
				}
				try {
					EventAggregator.Publish(new SessionDidStartSignOutEvent());
				}
				catch(Exception ex) {
					Log.Warning(ex, $"{nameof(LogoutAsync)} - {nameof(SessionDidStartSignOutEvent)}");
				}
				
				try {
					var settingsService = SettingsServiceFactory.Create();
					await CredentialsService.DeleteAsync(settingsService.ServerUrl.ToUri(), settingsService.Email);
				}
				catch (Exception ex) {
					Log.Warning(ex, $"{nameof(LogoutAsync)} - credentials");
				}

				try {
					await CodeStreamAgentService.LogoutAsync();
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - agent");
				}

				try {
					await ServiceLocator.Get<SUserSettingsService, IUserSettingsService>()?.TryDeleteTeamIdAsync();
				}
				catch(Exception ex) {
					Log.Error(ex, "could not delete teamId");
				}

				try {
					SessionService.Logout();
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - session");
				}

				try {
					EventAggregator.Publish(new SessionLogoutEvent());
				}
				catch(Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - {nameof(SessionLogoutEvent)}");
				}

				try {
#pragma warning disable VSTHRD103 // Call async methods when in an async method
					// it's possible that this Logout method is called before the webview is ready -- enqueue it
					WebviewIpc.EnqueueNotification(new HostDidLogoutNotificationType());
#pragma warning restore VSTHRD103 // Call async methods when in an async method
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - {nameof(HostDidLogoutNotificationType)}");
				}
				Log.Information($"{nameof(LogoutAsync)} completed");
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(LogoutAsync));
			}
		}
	}
}
