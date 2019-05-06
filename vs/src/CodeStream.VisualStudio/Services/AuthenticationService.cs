using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using Serilog;
using System;
using System.Threading.Tasks;
using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.Services {
	public interface SAuthenticationService { }
	public interface IAuthenticationService {
		Task LogoutAsync();
	}
	public class AuthenticationService : SAuthenticationService, IAuthenticationService {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationService>();

		private readonly ICredentialsService _credentialsService;
		private readonly IEventAggregator _eventAggregator;
		private readonly ISessionService _sessionService;
		private readonly ISettingsService _settingsService;
		private readonly ICodeStreamAgentService _agentService;
		private readonly IWebviewIpc _webviewIpc;

		public AuthenticationService(
			ICredentialsService credentialsService,
			IEventAggregator eventAggregator,
			ISessionService sessionService,
			ICodeStreamAgentService serviceProvider,
			IWebviewIpc webviewIpc,
			ISettingsService settingsService) {
			_credentialsService = credentialsService;
			_eventAggregator = eventAggregator;
			_sessionService = sessionService;
			_agentService = serviceProvider;
			_webviewIpc = webviewIpc;
			_settingsService = settingsService;
		}

		public async Task LogoutAsync() {
			try {
				if (_sessionService.IsReady == false) return;

				try {
					await _credentialsService.DeleteAsync(_settingsService.ServerUrl.ToUri(), _settingsService.Email);
				}
				catch (Exception ex) {
					Log.Warning(ex, $"{nameof(LogoutAsync)} - credentials");
				}

				try {
					await _agentService.LogoutAsync();
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - agent");
				}

				try {
					_sessionService.Logout();
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(LogoutAsync)} - session");
				}

				_eventAggregator.Publish(new SessionLogoutEvent());
#pragma warning disable VSTHRD103 // Call async methods when in an async method
				_webviewIpc.Notify(new HostDidLogoutNotificationType());
#pragma warning restore VSTHRD103 // Call async methods when in an async method

				_webviewIpc.BrowserService.LoadWebView();
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(LogoutAsync));
			}
		}
	}
}
