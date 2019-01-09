using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.Threading;

namespace CodeStream.VisualStudio
{
    public class WebViewRouter
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();

        // ReSharper disable once NotAccessedField.Local
        private readonly Lazy<ICredentialsService> _credentialsService;
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _codeStreamAgent;
        private readonly ISettingsService _settingsService;
        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browserService;
        private readonly IIdeService _ideService;

        public WebViewRouter(
            Lazy<ICredentialsService> credentialsService,
            ISessionService sessionService,
            ICodeStreamAgentService codeStreamAgent,
            ISettingsService settingsService,
            IEventAggregator eventAggregator,
            IBrowserService browserService,
            IIdeService ideService)
        {
            _credentialsService = credentialsService;
            _sessionService = sessionService;
            _codeStreamAgent = codeStreamAgent;
            _settingsService = settingsService;
            _eventAggregator = eventAggregator;
            _browserService = browserService;
            _ideService = ideService;
        }

        private CodeStreamMessage ParseMessageSafe(JToken token)
        {
            string type = null;
            try
            {
                type = token.Value<string>("type");
                return new CodeStreamMessage()
                {
                    Type = type,
                    Body = token.Value<JToken>("body")
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Token could not be parsed. Type={Type}", type);
            }

            return CodeStreamMessage.Empty();
        }

        //
        //
        //TODO use DI in the ctor rather than inline Package/ServiceLocator pattern
        //
        //

        public async System.Threading.Tasks.Task HandleAsync(WindowEventArgs e)
        {
            try
            {
                //guard against possibly non JSON-like data
                if (e?.Message == null || !e.Message.StartsWith("{"))
                {
                    // too noisy to log!
                    //Log.Verbose(e.Message, $"{nameof(WindowEventArgs)} not found");
                }
                else
                {
                    var message = ParseMessageSafe(JToken.Parse(e.Message));

                    Log.Verbose(e.Message);

                    switch (message.Type)
                    {
                        case "codestream:log":
                            {
                                Log.Warning(e.Message);
                                break;
                            }
                        case "codestream:telemetry":
                            {
                                //TODO can this stay inside the agent?
                                break;
                            }
                        case "codestream:response":
                            {
                                try
                                {
                                    var payload = message.Body?["payload"];
                                    if (!(payload is JValue) && payload?["post"] != null)
                                    {
                                        var postCreated = message.Body.ToObject<CreatePostResponse>();
                                        _eventAggregator.Publish(new CodemarkChangedEvent());
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Log.Error(ex, "codestream:response");
                                }

                                break;
                            }
                        case "codestream:interaction:clicked-reload-webview":
                            {
                                _browserService.ReloadWebView();
                                break;
                            }
                        case "codestream:interaction:thread-closed":
                        case "codestream:interaction:active-panel-changed":
                        case "codestream:interaction:thread-selected":
                            {
                                //unused
                                break;
                            }
                        case "codestream:interaction:svc-request":
                            {
                                // handles things like VSLS etc.
                                break;
                            }
                        case "codestream:subscription:file-changed":
                        case "codestream:unsubscribe:file-changed":
                            {
                                // noop
                                break;
                            }
                        case "codestream:interaction:changed-active-stream":
                            {
                                _sessionService.CurrentStreamId = message.Body.ToString();
                                break;
                            }
                        case "codestream:view-ready":
                            {
                                // ready -- nothing to do!
                                break;
                            }
                        case "codestream:request":
                            {
                                switch (message.Action)
                                {
                                    case "bootstrap":
                                        {
                                            WebviewIpcMessageResponse response = null;

                                            if (_settingsService.AutoSignIn && _settingsService.Email.IsNotNullOrWhiteSpace())
                                            {
                                                var token = await _credentialsService.Value.LoadAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
                                                if (token != null)
                                                {
                                                    var loginResponseWrapper = await _codeStreamAgent.LoginViaTokenAsync(_settingsService.Email, token.Item2, _settingsService.ServerUrl);

                                                    response = new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));
                                                    var success = false;

                                                    try
                                                    {
                                                        var loginResponse = loginResponseWrapper.ToObject<LoginResponseWrapper>();
                                                        if (loginResponse?.Result.Error.IsNotNullOrWhiteSpace() == true)
                                                        {
                                                            response.Body.Error = loginResponse.Result.Error;
                                                        }
                                                        else
                                                        {
                                                            _sessionService.State = loginResponse.Result.State;

                                                            response.Body.Payload =
                                                                await _codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State, _settingsService.GetSettings());
                                                            _sessionService.SetUserLoggedIn();
                                                            success = true;
                                                        }
                                                    }
                                                    catch (Exception ex)
                                                    {
                                                        response.Body.Error = ex.ToString();
                                                    }
                                                    finally
                                                    {
                                                        _browserService.PostMessage(response);
                                                    }

                                                    if (success)
                                                    {
                                                        _eventAggregator.Publish(new SessionReadyEvent());
                                                    }
                                                    else if (token != null)
                                                    {
                                                        await _credentialsService.Value.DeleteAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
                                                    }
                                                }
                                                else
                                                {
                                                    response = new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id)
                                                    {
                                                        Payload = new WebviewIpcMessageResponsePayload
                                                        {
                                                            Configs = new Config
                                                            {
                                                                ServerUrl = _settingsService.ServerUrl,
                                                                Email = _settingsService.Email,
                                                                OpenCommentOnSelect = _settingsService.OpenCommentOnSelect,
                                                                ShowHeadshots = _settingsService.ShowHeadshots,
                                                                ShowMarkers = _settingsService.ShowMarkers,
                                                                Team = _settingsService.Team,
                                                            },
                                                            Services = new Service(),
                                                        }
                                                    });
                                                    _browserService.PostMessage(response);
                                                }
                                            }
                                            else
                                            {
                                                response = new WebviewIpcMessageResponse(
                                                    new WebviewIpcMessageResponseBody(message.Id)
                                                    {
                                                        Payload = new WebviewIpcMessageResponsePayload
                                                        {
                                                            Configs = new Config
                                                            {
                                                                Email = _settingsService.Email,
                                                                OpenCommentOnSelect = _settingsService.OpenCommentOnSelect,
                                                                ShowHeadshots = _settingsService.ShowHeadshots,
                                                                ShowMarkers = _settingsService.ShowMarkers,
                                                                Team = _settingsService.Team,
                                                            },
                                                            Services = new Service(),
                                                        }
                                                    });
                                                _browserService.PostMessage(response);
                                            }

                                            break;
                                        }
                                    case "authenticate":
                                        {
                                            var response =
                                                new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));

                                            var success = false;
                                            string email = message.Params["email"].ToString();
                                            LoginResponseWrapper loginResponse = null;
                                            try
                                            {
                                                var loginResponsewrapper = await _codeStreamAgent.LoginAsync(
                                                    email,
                                                    message.Params["password"].ToString(),
                                                    _settingsService.ServerUrl
                                                );

                                                loginResponse = loginResponsewrapper.ToObject<LoginResponseWrapper>();
                                                if (loginResponse?.Result.Error.IsNotNullOrWhiteSpace() == true)
                                                {
                                                    if (Enum.TryParse(loginResponse.Result.Error,
                                                        out LoginResult loginResult))
                                                    {
                                                        if (loginResult == LoginResult.VERSION_UNSUPPORTED)
                                                        {
                                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                            InfoBarProvider.Instance.ShowInfoBar($"This version of {Application.Name} is no longer supported. Please upgrade to the latest version.");
                                                            break;
                                                        }

                                                        response.Body.Error = loginResult.ToString();
                                                    }
                                                    else
                                                    {
                                                        response.Body.Error = loginResponse.Result.Error;
                                                    }
                                                }
                                                else
                                                {                                                    
                                                    _sessionService.State = loginResponse.Result.State;

                                                    response.Body.Payload =
                                                        await _codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State,
                                                            _settingsService.GetSettings());
                                                    _sessionService.SetUserLoggedIn();
                                                    success = true;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }
                                            finally
                                            {
                                                _browserService.PostMessage(response);
                                            }

                                            if (success)
                                            {
                                                _eventAggregator.Publish(new SessionReadyEvent());

                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                using (var scope = SettingsScope.Create(_settingsService))
                                                {
                                                    scope.SettingsService.Email = email;
                                                }
                                                if (_settingsService.AutoSignIn && loginResponse != null)
                                                {
                                                    await _credentialsService.Value.SaveAsync(new Uri(_settingsService.ServerUrl), loginResponse.Result.State.Email, loginResponse.Result.LoginResponse.AccessToken);
                                                }
                                            }
                                            break;
                                        }
                                    case "go-to-signup":
                                        {
                                            var response = new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));
                                            try
                                            {
                                                _ideService.Navigate(
                                                    $"{_settingsService.WebAppUrl}/signup?force_auth=true&signup_token={_sessionService.GetOrCreateSignupToken()}");
                                                response.Body.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browserService.PostMessage(response);
                                            break;
                                        }
                                    case "go-to-slack-signin":
                                        {
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(message.Id)
                                            };

                                            try
                                            {
                                                _ideService.Navigate(
                                                   $"{_settingsService.WebAppUrl}/service-auth/slack?state={_sessionService.GetOrCreateSignupToken()}");
                                                response.Body.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browserService.PostMessage(response);
                                            break;
                                        }
                                    case "validate-signup":
                                        {
                                            var response = new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));
                                            var success = false;
                                            string email = null;

                                            try
                                            {
                                                var token = message.Params?.Value<string>();
                                                if (token.IsNullOrWhiteSpace())
                                                {
                                                    token = _sessionService.GetOrCreateSignupToken().ToString();
                                                }

                                                var loginResponseWrapper = await _codeStreamAgent.LoginViaOneTimeCodeAsync(token, _settingsService.ServerUrl);

                                                var loginResponse = loginResponseWrapper.ToObject<LoginResponseWrapper>();
                                                if (loginResponse?.Result.Error.IsNotNullOrWhiteSpace() == true)
                                                {
                                                    response.Body.Error = loginResponse.Result.Error;
                                                }
                                                else
                                                {
                                                    _sessionService.State = loginResponse.Result.State;
                                                    email = loginResponse.Result.State.Email;

                                                    response.Body.Payload =
                                                        await _codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State,
                                                            _settingsService.GetSettings());
                                                    _sessionService.SetUserLoggedIn();
                                                    success = true;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }
                                            finally
                                            {
                                                _browserService.PostMessage(response);
                                            }

                                            if (success)
                                            {
                                                _eventAggregator.Publish(new SessionReadyEvent());

                                                if (email.IsNotNullOrWhiteSpace())
                                                {
                                                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.Email = email;
                                                    }
                                                }
                                            }

                                            break;
                                        }
                                    case "show-markers":
                                        {
                                            var val = message.Params.ToObject<bool>();
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                            using (var scope = SettingsScope.Create(_settingsService))
                                            {
                                                scope.SettingsService.ShowMarkers = val;
                                            }

                                            _eventAggregator.Publish(new CodemarkVisibilityEvent() { IsVisible = val });

                                            _browserService.PostMessage(new WebviewIpcGenericMessageResponse("codestream:configs")
                                            {
                                                Body = new
                                                {
                                                    showMarkers = val
                                                }
                                            });
                                            break;
                                        }
                                    case "mute-all":
                                        {
                                            break;
                                        }
                                    case "open-comment-on-select":
                                        {
                                            var val = message.Params.ToObject<bool>();
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                            using (var scope = SettingsScope.Create(_settingsService))
                                            {
                                                scope.SettingsService.OpenCommentOnSelect = val;
                                            }

                                            _eventAggregator.Publish(new CodeStreamConfigurationChangedEvent()
                                            { OpenCommentOnSelect = val });

                                            _browserService.PostMessage(new WebviewIpcGenericMessageResponse("codestream:configs")
                                            {
                                                Body = new
                                                {
                                                    openCommentOnSelect = val
                                                }
                                            });
                                            break;
                                        }
                                    case "show-code":
                                        {
                                            var showCodeResponse = message.Params.ToObject<ShowCodeResponse>();

                                            var fromMarkerResponse = await _codeStreamAgent.GetDocumentFromMarkerAsync(
                                                new DocumentFromMarkerRequest()
                                                {
                                                    File = showCodeResponse.Marker.File,
                                                    RepoId = showCodeResponse.Marker.RepoId,
                                                    MarkerId = showCodeResponse.Marker.Id,
                                                    Source = showCodeResponse.Source
                                                });

                                            if (fromMarkerResponse?.TextDocument?.Uri != null)
                                            {
                                                var ide = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken
                                                    .None);

                                                var editorResponse = ide.OpenEditor(
                                                    fromMarkerResponse.TextDocument.Uri.FromUri(),
                                                    fromMarkerResponse.Range?.Start?.Line);
                                                _browserService.PostMessage(new WebviewIpcMessageResponse(
                                                    new WebviewIpcMessageResponseBody(message.Id)
                                                    {
                                                        Payload = editorResponse.ToString()
                                                    }));
                                            }

                                            break;
                                        }

                                    default:
                                        {
                                            var response =
                                                new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));
                                            try
                                            {
                                                response.Body.Payload =
                                                    await _codeStreamAgent.SendAsync<object>(message.Action, message.Params);
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browserService.PostMessage(response);
                                            break;
                                        }
                                }

                                break;
                            }
                        default:
                            {
                                Log.Verbose("Unknown Message={Message}", e.Message);
                                break;
                            }
                    }
                }

            }
            catch (Exception ex)
            {
                Log.Error(ex, "Router Message={Message}", e?.Message);
            }

            await System.Threading.Tasks.Task.CompletedTask;
        }
    }
}
