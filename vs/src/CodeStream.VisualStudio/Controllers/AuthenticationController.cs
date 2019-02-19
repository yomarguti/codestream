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

namespace CodeStream.VisualStudio.Controllers
{
    public class AuthenticationController
    {
        private static readonly ILogger Log = LogManager.ForContext<AuthenticationController>();

        private ISettingsService _settingsService;
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _codeStreamAgent;
        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browserService;
        private readonly IIdeService _ideService;
        private readonly Lazy<ICredentialsService> _credentialsService;

        public AuthenticationController(
            ISettingsService settingsService,
            ISessionService sessionService,
            ICodeStreamAgentService codeStreamAgent,
            IEventAggregator eventAggregator,
            IBrowserService browserService,
            IIdeService ideService,
            Lazy<ICredentialsService> credentialsService)
        {
            _settingsService = settingsService;
            _sessionService = sessionService;
            _codeStreamAgent = codeStreamAgent;
            _eventAggregator = eventAggregator;
            _browserService = browserService;
            _ideService = ideService;
            _credentialsService = credentialsService;
        }

        public async Task GoToSignupAsync(string messageId)
        {
            string error = null;

            try
            {
                _ideService.Navigate($"{_settingsService.WebAppUrl}/signup?force_auth=true&signup_token={_sessionService.GetOrCreateSignupToken()}");
            }
            catch (Exception ex)
            {
                error = ex.ToString();
                Log.Error(ex, $"{nameof(GoToSignupAsync)}");
            }

            _browserService.PostMessage(Ipc.ToResponseMessage(messageId, true, error));

            await Task.CompletedTask;
        }

        public async Task GoToSlackSigninAsync(string messageId)
        {
            string error = null;

            try
            {
                _ideService.Navigate($"{_settingsService.WebAppUrl}/service-auth/slack?state={_sessionService.GetOrCreateSignupToken()}");

            }
            catch (Exception ex)
            {
                error = ex.ToString();
                Log.Error(ex, $"{nameof(GoToSlackSigninAsync)}");
            }

            _browserService.PostMessage(Ipc.ToResponseMessage(messageId, true, error));

            await Task.CompletedTask;
        }

        public async Task AuthenticateAsync(string messageId, string email, string password)
        {
            var success = false;
            JToken payload = null;
            string errorResponse = null;
            JToken loginResponse = null;

            try
            {
                loginResponse = await _codeStreamAgent.LoginAsync(email, password, _settingsService.ServerUrl);

                var error = GetError(loginResponse);
                if (error != null)
                {
                    if (Enum.TryParse(error.ToString(), out LoginResult loginResult))
                    {
                        var handleError = await HandleErrorAsync(loginResult);
                        if (!handleError)
                        {
                            errorResponse = loginResult.ToString();
                            await Task.CompletedTask;
                        }
                        else
                        {
                            errorResponse = loginResult.ToString();
                        }
                    }
                    else
                    {
                        errorResponse = error.ToString();
                    }
                    Log.Warning(errorResponse);
                }
                else if (loginResponse != null)
                {
                    var state = GetState(loginResponse);
                    payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings(), state, true);
                    _sessionService.SetUserLoggedIn(CreateUser(loginResponse));
                    success = true;
                }
            }
            catch (Exception ex)
            {
                errorResponse = ex.ToString();
                Log.Error(ex, $"{nameof(AuthenticateAsync)}");
            }
            finally
            {
                _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
            }

            if (success)
            {
                await OnSuccessAsync(loginResponse, email);
            }
            await Task.CompletedTask;
        }

        public async Task BootstrapAsync(string messageId)
        {
            string errorResponse = null;
            JToken loginResponse;
            JToken payload = null;

            if (_settingsService.AutoSignIn && !_settingsService.Email.IsNullOrWhiteSpace())
            {
                var token = await _credentialsService.Value.LoadAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
                if (token != null)
                {
                    loginResponse = await _codeStreamAgent.LoginViaTokenAsync(_settingsService.Email, token.Item2, _settingsService.ServerUrl);
                    var success = false;
                    try
                    {
                        var error = GetError(loginResponse);
                        if (error != null)
                        {
                            errorResponse = error.ToString();
                        }
                        else if (loginResponse != null)
                        {
                            var state = GetState(loginResponse);
                            payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings(), state, true);
                            _sessionService.SetUserLoggedIn(CreateUser(loginResponse));
                            success = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        errorResponse = ex.ToString();
                        Log.Debug(ex, $"{nameof(BootstrapAsync)}");
                    }
                    if (success)
                    {
                        _eventAggregator.Publish(new SessionReadyEvent());
                    }
                    else
                    {
                        await _credentialsService.Value.DeleteAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
                    }
                }
                else
                {
                    payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings());
                }
            }
            else
            {
                payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings());
            }

            _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
            await Task.CompletedTask;
        }

        public async Task ValidateSignupAsync(string messageId, string token)
        {
            var success = false;
            string email = null;
            string errorResponse = null;
            JToken loginResponse = null;
            JToken payload = null;

            try
            {
                if (token.IsNullOrWhiteSpace())
                {
                    token = _sessionService.GetOrCreateSignupToken().ToString();
                }

                loginResponse = await _codeStreamAgent.LoginViaOneTimeCodeAsync(token, _settingsService.ServerUrl);

                var error = GetError(loginResponse);
                if (error != null)
                {
                    if (Enum.TryParse(error.ToString(), out LoginResult loginResult))
                    {
                        var handleError = await HandleErrorAsync(loginResult);
                        if (!handleError)
                        {
                            errorResponse = loginResult.ToString();
                            await Task.CompletedTask;
                        }
                        else
                        {
                            errorResponse = loginResult.ToString();
                        }
                    }
                    else
                    {
                        errorResponse = error.ToString();
                    }
                    Log.Warning(errorResponse);
                }
                else if (loginResponse != null)
                {
                    email = GetEmail(loginResponse).ToString();
                    var state = GetState(loginResponse);
                    payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings(), state, true);
                    _sessionService.SetUserLoggedIn(CreateUser(loginResponse));
                    success = true;
                }
            }
            catch (Exception ex)
            {
                errorResponse = ex.ToString();
                Log.Error(ex, $"{nameof(ValidateSignupAsync)}");
            }
            finally
            {
                _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
            }

            if (success)
            {
                await OnSuccessAsync(loginResponse, email);
            }
            await Task.CompletedTask;
        }

        private async Task OnSuccessAsync(JToken loginResponse, string email)
        {
            _eventAggregator.Publish(new SessionReadyEvent());

            if (!email.IsNullOrWhiteSpace())
            {
                await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                using (var scope = SettingsScope.Create(_settingsService))
                {
                    scope.SettingsService.Email = email;
                }
                if (_settingsService.AutoSignIn)
                {
                    await _credentialsService.Value.SaveAsync(new Uri(_settingsService.ServerUrl), email, GetAccessToken(loginResponse).ToString());
                }
            }

            await Task.CompletedTask;
        }

        private async Task<bool> HandleErrorAsync(LoginResult loginResult)
        {
            await Task.Yield();

            if (loginResult == LoginResult.VERSION_UNSUPPORTED)
            {
                await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                InfoBarProvider.Instance.ShowInfoBar($"This version of {Application.Name} is no longer supported. Please upgrade to the latest version.");
                return false;
            }
            else
            {
                return true;
            }
        }

        private User CreateUser(JToken token)
        {
            var user = token?["result"]?["loginResponse"]?["user"].ToObject<CsUser>();
            var teamId = token?["result"]?["loginResponse"]?["teamId"].Value<string>();

            var teams = (token?["result"]?["loginResponse"]?["teams"].ToObject<List<CsTeam>>() ?? Enumerable.Empty<CsTeam>()).ToList();
            string teamName = teams.Where(_ => _.Id == teamId)
                    .Select(_ => _.Name)
                    .FirstOrDefault();

            return new User(user.Id, user.Username, user.Email, teamName, teams.Count);
        }

        private JToken GetState(JToken token) => token?["result"]?["state"];
        private JToken GetEmail(JToken token) => token?["result"]?["loginResponse"]?["user"]?["email"];
        private JToken GetAccessToken(JToken token) => token?["result"]?["loginResponse"]?["accessToken"];
        private JToken GetError(JToken token) => token != null && token.HasValues && token["result"] != null ? token?["result"]?["error"] : new JValue(LoginResult.UNKNOWN.ToString());
    }
}
