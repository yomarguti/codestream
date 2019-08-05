using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;
using Newtonsoft.Json.Linq;
using Serilog;

namespace CodeStream.VisualStudio.Core.Controllers {
	public class AuthenticationController {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationController>();

		private readonly ISettingsManager _settingsManager;
		private readonly ISessionService _sessionService;
		private readonly ICodeStreamAgentService _codeStreamAgent;
		private readonly IEventAggregator _eventAggregator;
		private readonly ICredentialsService _credentialsService;

		public AuthenticationController(
			ISettingsManager settingManager,
			ISessionService sessionService,
			ICodeStreamAgentService codeStreamAgent,
			IEventAggregator eventAggregator,
			ICredentialsService credentialsService) {
			_settingsManager = settingManager;
			_sessionService = sessionService;
			_codeStreamAgent = codeStreamAgent;
			_eventAggregator = eventAggregator;
			_credentialsService = credentialsService;
		}

		public AuthenticationController(
			ISettingsManager settingManager,
			ISessionService sessionService,
			IEventAggregator eventAggregator,
			ICredentialsService credentialsService) {
			_settingsManager = settingManager;
			_sessionService = sessionService;
			_eventAggregator = eventAggregator;
			_credentialsService = credentialsService;
		}

		public async Task<bool> TryAutoSignInAsync() {
			try {
				ProcessLoginResponse processResponse = null;

				if (_settingsManager.AutoSignIn && !_settingsManager.Email.IsNullOrWhiteSpace()) {
					var token = await _credentialsService.LoadJsonAsync(_settingsManager.ServerUrl.ToUri(), _settingsManager.Email);
					if (token != null) {
						try {
							var teamId = await ServiceLocator.Get<SUserSettingsService, IUserSettingsService>()?.TryGetTeamIdAsync();
							var loginResponse = await _codeStreamAgent.LoginViaTokenAsync(token, _settingsManager.Team, teamId);
							processResponse = await ProcessLoginAsync(loginResponse);

							if (!processResponse.Success) {
								if (!processResponse.ErrorMessage.IsNullOrWhiteSpace() &&
									Enum.TryParse(processResponse.ErrorMessage, out LoginResult loginResult) && loginResult != LoginResult.VERSION_UNSUPPORTED) {
									await _credentialsService.DeleteAsync(_settingsManager.ServerUrl.ToUri(), _settingsManager.Email);
								}
								return false;
							}
							else {
								await OnSuccessAsync(loginResponse, processResponse.Email);
								return true;
							}
						}
						catch (Exception ex) {
							Log.Warning(ex, $"{nameof(TryAutoSignInAsync)}");
						}
					}
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(TryAutoSignInAsync));
			}

			return false;
		}

		public async Task<bool> CompleteSigninAsync(JToken loginResponse) {
			ProcessLoginResponse processResponse = null;
			try {

				try {
					processResponse = await ProcessLoginAsync(loginResponse);
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(CompleteSigninAsync)}");
				}

				if (processResponse?.Success == true) {
					await OnSuccessAsync(loginResponse, processResponse.Email);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(CompleteSigninAsync));
			}

			return processResponse?.Success == true;
		}

		private async Task OnSuccessAsync(JToken loginResponse, string email) {
			_sessionService.SetState(SessionState.UserSignedIn);
			_eventAggregator.Publish(new SessionReadyEvent());

			if (!email.IsNullOrWhiteSpace()) {
				await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
				using (var scope = SettingsScope.Create(_settingsManager)) {
					scope.SettingsManager.Email = email;
				}

				if (_settingsManager.AutoSignIn) {
					await _credentialsService.SaveJsonAsync(_settingsManager.ServerUrl.ToUri(), email, GetAccessToken(loginResponse));
				}

				await ServiceLocator.Get<SUserSettingsService, IUserSettingsService>()?.TrySaveTeamIdAsync(GetTeamId(loginResponse));
			}

			await Task.CompletedTask;
		}

		private async Task<ProcessLoginResponse> ProcessLoginAsync(JToken loginResponse) {
			var response = new ProcessLoginResponse();
			var error = GetError(loginResponse);

			if (error != null) {
				//string errorResponse;
				//if (Enum.TryParse(error.ToString(), out LoginResult loginResult)) {
				//	// this is now handled in the webview
				//	//if (loginResult == LoginResult.VERSION_UNSUPPORTED) {
				//	//	await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
				//	//	InfoBarProvider.Instance.ShowInfoBar($"This version of {Application.Name} is no longer supported. Please upgrade to the latest version.");
				//	//}
				//	errorResponse = loginResult.ToString();
				//}
				//else {
				//	errorResponse = error.ToString();
				//}
				//Log.Warning(errorResponse);
				response.ErrorMessage = error?.Value<string>();
			}
			else if (loginResponse != null) {
				response.Email = GetEmail(loginResponse).ToString();

				// don't want all the data in state -- some is sensitive
				var state = GetState(loginResponse);
				var stateLite = JObject.FromObject(new { });
				stateLite["capabilities"] = state["capabilities"];
				stateLite["teamId"] = state["teamId"];
				stateLite["userId"] = state["userId"];
				stateLite["email"] = state["email"];

				_sessionService.SetUser(CreateUser(loginResponse), stateLite);
				response.Success = true;
			}

			return response;
		}

		private User CreateUser(JToken token) {
			var user = token?["loginResponse"]?["user"].ToObject<CsUser>();
			var teamId = GetTeamId(token);

			var teams = (token?["loginResponse"]?["teams"].ToObject<List<CsTeam>>() ?? Enumerable.Empty<CsTeam>())
				.ToList();
			string teamName = teams.Where(_ => _.Id == teamId)
				.Select(_ => _.Name)
				.FirstOrDefault();

			return new User(user.Id, user.Username, user.Email, teamName, teams.Count);
		}

		private string GetTeamId(JToken token) => token?["state"]["teamId"].Value<string>();

		private JToken GetState(JToken token) => token?["state"];
		private JToken GetEmail(JToken token) => token?["loginResponse"]?["user"]?["email"];
		private JToken GetAccessToken(JToken token) => token?["state"]?["token"];
		private JToken GetError(JToken token) {
			if (token != null && token.HasValues && token["error"] != null) {
				return token["error"] ?? new JValue(LoginResult.UNKNOWN.ToString());
			}

			return null;
		}

		class ProcessLoginResponse {
			public bool Success { get; set; }
			public string ErrorMessage { get; set; }
			public string Email { get; set; }
			public JToken Params { get; set; }
		}
	}
}
