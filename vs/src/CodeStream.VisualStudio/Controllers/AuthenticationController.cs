using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Controllers {
	public class AuthenticationController {
		private static readonly ILogger Log = LogManager.ForContext<AuthenticationController>();

		private readonly ISettingsManager _settingsManager;
		private readonly ISessionService _sessionService;
		private readonly ICodeStreamAgentService _codeStreamAgent;
		private readonly IEventAggregator _eventAggregator;
		private readonly IBrowserService _browserService;
		private readonly IIdeService _ideService;
		private readonly ICredentialsService _credentialsService;

		public AuthenticationController(
			ISettingsManager settingManager,
			ISessionService sessionService,
			ICodeStreamAgentService codeStreamAgent,
			IEventAggregator eventAggregator,
			IBrowserService browserService,
			IIdeService ideService,
			ICredentialsService credentialsService) {
			_settingsManager = settingManager;
			_sessionService = sessionService;
			_codeStreamAgent = codeStreamAgent;
			_eventAggregator = eventAggregator;
			_browserService = browserService;
			_ideService = ideService;
			_credentialsService = credentialsService;
		}

		public async Task SlackLoginAsync(WebviewIpcMessage message) {
			string error = null;
			using (var scope = _browserService.CreateScope(message)) {
				try {
					_ideService.Navigate($"{_settingsManager.ServerUrl}/web/provider-auth/slack?signupToken={_sessionService.GetOrCreateSignupToken()}");
				}
				catch (Exception ex) {
					error = ex.ToString();
					Log.Error(ex, $"{nameof(SlackLoginAsync)}");
				}

				scope.FulfillRequest(error);
			}

			await Task.CompletedTask;
		}

		public async Task LoginAsync(WebviewIpcMessage message, string email, string password) {
			var success = false;
			JToken @params = null;
			string errorResponse = null;
			JToken loginResponse = null;
			try {
				using (var scope = _browserService.CreateScope(message)) {
					try {
						loginResponse = await _codeStreamAgent.LoginAsync(email, password, _settingsManager.ServerUrl);

						var error = GetError(loginResponse);
						if (error != null) {
							if (Enum.TryParse(error.ToString(), out LoginResult loginResult)) {
								var handleError = await HandleErrorAsync(loginResult);
								if (!handleError) {
									errorResponse = loginResult.ToString();
									await Task.CompletedTask;
								}
								else {
									errorResponse = loginResult.ToString();
								}
							}
							else {
								errorResponse = error.ToString();
							}

							Log.Warning(errorResponse);
						}
						else if (loginResponse != null) {
							var state = GetState(loginResponse);
							@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings(), state,
								true);
							_sessionService.SetUserLoggedIn(CreateUser(loginResponse));
							success = true;
						}
					}
					catch (Exception ex) {
						errorResponse = ex.ToString();
						Log.Error(ex, $"{nameof(LoginAsync)}");
					}

					scope.FulfillRequest(@params, errorResponse);
				}

				if (success) {
					await OnSuccessAsync(loginResponse, email);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(LoginAsync));
			}

			await Task.CompletedTask;
		}

		public async Task BootstrapAsync(WebviewIpcMessage message) {
			try {
				string errorResponse = null;
				JToken @params = null;
				var success = false;
				using (var scope = _browserService.CreateScope(message)) {
					if (_settingsManager.AutoSignIn && !_settingsManager.Email.IsNullOrWhiteSpace()) {
						var token = await _credentialsService.LoadAsync(_settingsManager.ServerUrl.ToUri(),
							_settingsManager.Email);
						if (token != null) {
							var loginResponse = await _codeStreamAgent.LoginViaTokenAsync(new LoginAccessToken(token.Item1, _settingsManager.ServerUrl, token.Item2), _settingsManager.Team);
							try {
								var error = GetError(loginResponse);
								if (error != null) {
									errorResponse = error.ToString();
								}
								else if (loginResponse != null) {
									var state = GetState(loginResponse);
									@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings(), state, true);
									_sessionService.SetUserLoggedIn(CreateUser(loginResponse));
									success = true;
								}
							}
							catch (Exception ex) {
								errorResponse = ex.ToString();
								Log.Debug(ex, $"{nameof(BootstrapAsync)}");
							}
						}
						else {
							@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings());
						}
					}
					else {
						@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings());
					}

					scope.FulfillRequest(@params, errorResponse);
				}

				if (success) {
					_eventAggregator.Publish(new SessionReadyEvent());
				}
				else {
					await _credentialsService.DeleteAsync(_settingsManager.ServerUrl.ToUri(), _settingsManager.Email);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(BootstrapAsync));
			}

			await Task.CompletedTask;
		}

		public async Task CompleteSignupAsync(WebviewIpcMessage message, CompleteSignupRequest request) {
			var success = false;
			string email = null;
			string errorResponse = null;
			JToken loginResponse = null;
			JToken @params = null;
			try {
				using (var scope = _browserService.CreateScope(message)) {
					try {
						loginResponse = await _codeStreamAgent.LoginViaTokenAsync(new LoginAccessToken(request.Email, _settingsManager.ServerUrl, request.Token), _settingsManager.Team);

						var error = GetError(loginResponse);
						if (error != null) {
							if (Enum.TryParse(error.ToString(), out LoginResult loginResult)) {
								var handleError = await HandleErrorAsync(loginResult);
								if (!handleError) {
									errorResponse = loginResult.ToString();
									await Task.CompletedTask;
								}
								else {
									errorResponse = loginResult.ToString();
								}
							}
							else {
								errorResponse = error.ToString();
							}

							Log.Warning(errorResponse);
						}
						else if (loginResponse != null) {
							email = GetEmail(loginResponse).ToString();
							var state = GetState(loginResponse);
							@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings(), state,
								true);
							_sessionService.SetUserLoggedIn(CreateUser(loginResponse));
							success = true;
						}
					}
					catch (Exception ex) {
						errorResponse = ex.ToString();
						Log.Error(ex, $"{nameof(CompleteSignupAsync)}");
					}

					scope.FulfillRequest(@params, errorResponse);
				}

				if (success) {
					await OnSuccessAsync(loginResponse, email);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(CompleteSignupAsync));
			}

			await Task.CompletedTask;
		}

		public async Task ValidateThirdPartyAuthAsync(WebviewIpcMessage message, ValidateThirdPartyAuthRequest extras) {
			var success = false;
			string email = null;
			string errorResponse = null;
			JToken loginResponse = null;
			JToken @params = null;
			try {
				using (var scope = _browserService.CreateScope(message)) {
					try {
						loginResponse = await _codeStreamAgent.OtcLoginRequestAsync(new OtcLoginRequest {
							Code = _sessionService.GetOrCreateSignupToken().ToString(),
							Alias = extras?.Alias
						});

						var error = GetError(loginResponse);
						if (error != null) {
							if (Enum.TryParse(error.ToString(), out LoginResult loginResult)) {
								var handleError = await HandleErrorAsync(loginResult);
								if (!handleError) {
									errorResponse = loginResult.ToString();
									await Task.CompletedTask;
								}
								else {
									errorResponse = loginResult.ToString();
								}
							}
							else {
								errorResponse = error.ToString();
							}

							Log.Warning(errorResponse);
						}
						else if (loginResponse != null) {
							email = GetEmail(loginResponse).ToString();
							var state = GetState(loginResponse);
							@params = await _codeStreamAgent.GetBootstrapAsync(_settingsManager.GetSettings(), state,
								true);
							_sessionService.SetUserLoggedIn(CreateUser(loginResponse));
							success = true;
						}
					}
					catch (Exception ex) {
						errorResponse = ex.ToString();
						Log.Error(ex, $"{nameof(ValidateThirdPartyAuthAsync)}");
					}

					scope.FulfillRequest(@params, errorResponse);
				}

				if (success) {
					await OnSuccessAsync(loginResponse, email);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(ValidateThirdPartyAuthAsync));
			}

			await Task.CompletedTask;
		}

		private async Task OnSuccessAsync(JToken loginResponse, string email) {
			_eventAggregator.Publish(new SessionReadyEvent());

			if (!email.IsNullOrWhiteSpace()) {
				await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
				using (var scope = SettingsScope.Create(_settingsManager)) {
					scope.SettingsManager.Email = email;
				}

				if (_settingsManager.AutoSignIn) {
					await _credentialsService.SaveAsync(_settingsManager.ServerUrl.ToUri(), email,
						GetAccessToken(loginResponse).ToString());
				}
			}

			await Task.CompletedTask;
		}

		private async Task<bool> HandleErrorAsync(LoginResult loginResult) {
			await Task.Yield();

			if (loginResult == LoginResult.VERSION_UNSUPPORTED) {
				await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
				InfoBarProvider.Instance.ShowInfoBar(
					$"This version of {Application.Name} is no longer supported. Please upgrade to the latest version.");
				return false;
			}
			else {
				return true;
			}
		}

		private User CreateUser(JToken token) {
			var user = token?["loginResponse"]?["user"].ToObject<CsUser>();
			var teamId = token?["loginResponse"]?["teamId"].Value<string>();

			var teams = (token?["loginResponse"]?["teams"].ToObject<List<CsTeam>>() ?? Enumerable.Empty<CsTeam>())
				.ToList();
			string teamName = teams.Where(_ => _.Id == teamId)
				.Select(_ => _.Name)
				.FirstOrDefault();

			return new User(user.Id, user.Username, user.Email, teamName, teams.Count);
		}

		private JToken GetState(JToken token) => token?["state"];
		private JToken GetEmail(JToken token) => token?["loginResponse"]?["user"]?["email"];
		private JToken GetAccessToken(JToken token) => token?["loginResponse"]?["accessToken"];

		private JToken GetError(JToken token) {
			if (token != null && token.HasValues && token["error"] != null) {
				return token["error"] ?? new JValue(LoginResult.UNKNOWN.ToString());
			}

			return null;
		}
	}
}
