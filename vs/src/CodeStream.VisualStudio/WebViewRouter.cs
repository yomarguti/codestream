using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.Threading;

namespace CodeStream.VisualStudio
{
    public class WebViewRouter
    {
        static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();

        private readonly IServiceProvider _serviceProvider;
        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browser;

        public WebViewRouter(IServiceProvider serviceProvider, IEventAggregator eventAggregator, IBrowserService browser)
        {
            _serviceProvider = serviceProvider;
            _eventAggregator = eventAggregator;
            _browser = browser;
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

                    var codeStreamAgent =
                        Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
                    var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

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
                                _browser.ReloadWebView();
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
                                sessionService.CurrentStreamId = message.Body.ToString();
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
                                            var settings =
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
                                            var response = new WebviewIpcMessageResponse(
                                                new WebviewIpcMessageResponseBody(message.Id)
                                                {
                                                    Payload = new WebviewIpcMessageResponsePayload
                                                    {
                                                        Configs = new Config()
                                                        {
                                                            Email = settings?.Email
                                                        },
                                                        Services = new Service(),
                                                    }
                                                });

                                            _browser.PostMessage(response);
                                            break;
                                        }
                                    case "authenticate":
                                        {
                                            var response =
                                                new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));
                                            var settings =
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;

                                            var success = false;
                                            string email = message.Params["email"].ToString();

                                            try
                                            {
                                                var loginResponsewrapper = await codeStreamAgent.LoginAsync(
                                                    email,
                                                    message.Params["password"].ToString(),
                                                    settings.ServerUrl
                                                );

                                                var loginResponse = loginResponsewrapper.ToObject<LoginResponseWrapper>();
                                                if (loginResponse?.Result.Error.IsNotNullOrWhiteSpace() == true)
                                                {
                                                    response.Body.Error = loginResponse.Result.Error;
                                                }
                                                else
                                                {
                                                    sessionService.LoginResponse = loginResponse.Result.LoginResponse;
                                                    sessionService.State = loginResponse.Result.State;

                                                    response.Body.Payload =
                                                        await codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State,
                                                            settings.GetSettings());
                                                    sessionService.SetUserLoggedIn();
                                                    success = true;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }
                                            finally
                                            {
                                                _browser.PostMessage(response);
                                            }

                                            if (success)
                                            {
                                                _eventAggregator.Publish(new SessionReadyEvent());

                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                using (var scope = SettingsScope.Create(
                                                    Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService))
                                                {
                                                    scope.SettingsService.Email = email;
                                                }
                                            }

                                            break;
                                        }
                                    case "go-to-signup":
                                        {
                                            var settings =
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
                                            var response =
                                                new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message?.Id));

                                            try
                                            {
                                                var hostService =
                                                    Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                                hostService.Navigate(
                                                    $"{settings.WebAppUrl}/signup?force_auth=true&signup_token={sessionService.GetOrCreateSignupToken()}");
                                                response.Body.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browser.PostMessage(response);
                                            break;
                                        }
                                    case "go-to-slack-signin":
                                        {
                                            var settings =
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;

                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(message.Id)
                                            };

                                            try
                                            {
                                                var hostService =
                                                    Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                                hostService.Navigate(
                                                    $"{settings.WebAppUrl}/service-auth/slack?state={sessionService.GetOrCreateSignupToken()}");
                                                response.Body.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browser.PostMessage(response);
                                            break;
                                        }
                                    case "validate-signup":
                                        {
                                            var settings =
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
                                            var response =
                                                new WebviewIpcMessageResponse(new WebviewIpcMessageResponseBody(message.Id));

                                            var success = false;
                                            string email = null;
                                            try
                                            {
                                                var token = message?.Params?.Value<string>();
                                                if (token.IsNullOrWhiteSpace())
                                                {
                                                    token = sessionService.GetOrCreateSignupToken().ToString();
                                                }

                                                var loginResponseWrapper =
                                                    await codeStreamAgent.LoginViaTokenAsync(token, settings.ServerUrl);

                                                var loginResponse = loginResponseWrapper.ToObject<LoginResponseWrapper>();
                                                if (loginResponse?.Result.Error.IsNotNullOrWhiteSpace() == true)
                                                {
                                                    response.Body.Error = loginResponse.Result.Error;
                                                }
                                                else
                                                {
                                                    sessionService.LoginResponse = loginResponse.Result.LoginResponse;
                                                    sessionService.State = loginResponse.Result.State;
                                                    email = loginResponse.Result.State.Email;

                                                    response.Body.Payload =
                                                        await codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State,
                                                            settings.GetSettings());
                                                    sessionService.SetUserLoggedIn();
                                                    success = true;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }
                                            finally
                                            {
                                                _browser.PostMessage(response);
                                            }

                                            if (success)
                                            {
                                                _eventAggregator.Publish(new SessionReadyEvent());

                                                if (email.IsNotNullOrWhiteSpace())
                                                {
                                                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                    using (var scope = SettingsScope.Create(
                                                        Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService))
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
                                            using (var scope = SettingsScope.Create(
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService))
                                            {
                                                scope.SettingsService.ShowMarkers = val;
                                            }

                                            _eventAggregator.Publish(new CodemarkVisibilityEvent() { IsVisible = val });

                                            _browser.PostMessage(new WebviewIpcGenericMessageResponse("codestream:configs")
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
                                            using (var scope = SettingsScope.Create(
                                                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService))
                                            {
                                                scope.SettingsService.OpenCommentOnSelect = val;
                                            }

                                            _eventAggregator.Publish(new CodeStreamConfigurationChangedEvent()
                                            { OpenCommentOnSelect = val });

                                            _browser.PostMessage(new WebviewIpcGenericMessageResponse("codestream:configs")
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
                                            var agentService =
                                                Package.GetGlobalService(typeof(SCodeStreamAgentService)) as
                                                    ICodeStreamAgentService;
                                            var fromMarkerResponse = await agentService.GetDocumentFromMarkerAsync(
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
                                                _browser.PostMessage(new WebviewIpcMessageResponse(
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
                                                    await codeStreamAgent.SendAsync<object>(message.Action, message.Params);
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }

                                            _browser.PostMessage(response);
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
