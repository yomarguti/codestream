using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using Serilog;
using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Services {

	public interface IAuthenticationServiceFactory {
		IAuthenticationService Create();
	}

	[Export(typeof(IAuthenticationServiceFactory))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class AuthenticationServiceFactory : ServiceFactory<IAuthenticationService>, IAuthenticationServiceFactory {
		[ImportingConstructor]
		public AuthenticationServiceFactory([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) :
			base(serviceProvider) {
		}
	}

	public interface IAuthenticationService {
		System.Threading.Tasks.Task LogoutAsync();
	}

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
			try {
				if (SessionService.IsReady == false) return;
				var settingsService = SettingsServiceFactory.Create();
				try {
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
					SessionService.Logout();
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - session");
				}

				try {
					await ServiceLocator.Get<SUserSettingsService, IUserSettingsService>()?.TryDeleteTeamIdAsync();
				}
				catch(Exception ex) {
					Log.Error(ex, "could not delete teamId");
				}

				EventAggregator.Publish(new SessionLogoutEvent());
#pragma warning disable VSTHRD103 // Call async methods when in an async method
				WebviewIpc.Notify(new HostDidLogoutNotificationType());
#pragma warning restore VSTHRD103 // Call async methods when in an async method				
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(LogoutAsync));
			}
		}
	}
}
