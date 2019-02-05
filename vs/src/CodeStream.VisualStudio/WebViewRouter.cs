using CodeStream.VisualStudio.Controllers;
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
                                break;
                            }
                        case "codestream:response":
                            {
                                break;
                            }
                        case "codestream:interaction:clicked-reload-webview":
                            {
                                _browserService.ReloadWebView();
                                break;
                            }
                        case "codestream:interaction:thread-closed":
                            {
                                break;
                            }
                        case "codestream:interaction:active-panel-changed":
                            {
                                break;
                            }
                        case "codestream:interaction:thread-selected":
                            {
                                //unused
                                break;
                            }
                        case "codestream:interaction:svc-request":
                            {
                                var sr = message.Body.ToObject<ServiceRequest>();

                                if (sr.Service.EqualsIgnoreCase("vsls"))
                                {
                                    var liveShareController = new LiveShareController(
                                        _sessionService,
                                        _codeStreamAgent,
                                        _eventAggregator,
                                        _browserService,
                                        _ideService);

                                    switch (sr.Action.Type)
                                    {
                                        case "start":
                                            {
                                                await liveShareController.StartAsync(sr.Action.StreamId, sr.Action.ThreadId);
                                                break;
                                            }
                                        case "invite":
                                            {
                                                await liveShareController.InviteAsync(sr.Action.UserId);
                                                break;
                                            }
                                        case "join":
                                            {
                                                await liveShareController.JoinAsync(sr.Action?.Url);
                                                break;
                                            }
                                        default:
                                            {
                                                Log.Verbose($"Unknown svc-request type {sr.Action.Type}");
                                                break;
                                            }
                                    }
                                }
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
                                    case "authenticate":
                                    case "go-to-signup":
                                    case "go-to-slack-signin":
                                    case "validate-signup":
                                        {
                                            var authenticationController = new AuthenticationController(
                                                _settingsService,
                                                _sessionService,
                                                _codeStreamAgent,
                                                _eventAggregator,
                                                _browserService,
                                                _ideService,
                                                _credentialsService);

                                            switch (message.Action)
                                            {
                                                case "bootstrap":
                                                    await authenticationController.BootstrapAsync(message.Id);
                                                    break;
                                                case "authenticate":
                                                    await authenticationController.AuthenticateAsync(message.Id, message.Params["email"].ToString(), message.Params["password"].ToString());
                                                    break;
                                                case "go-to-signup":
                                                    await authenticationController.GoToSignupAsync(message.Id);
                                                    break;
                                                case "go-to-slack-signin":
                                                    await authenticationController.GoToSlackSigninAsync(message.Id);
                                                    break;
                                                case "validate-signup":
                                                    await authenticationController.ValidateSignupAsync(message.Id, message.Params?.Value<string>());
                                                    break;
                                                default:
                                                    Log.Warning($"Shouldn't hit this Action={message.Action}");
                                                    break;
                                            }
                                            break;
                                        }
                                    case "show-markers":
                                    case "open-comment-on-select":
                                        {
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                            var value = message.Params.ToObject<bool>();

                                            switch (message.Action)
                                            {
                                                case "show-markers":
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.ShowMarkers = value;
                                                    }

                                                    break;
                                                case "open-comment-on-select":
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.OpenCommentOnSelect = value;
                                                    }

                                                    break;
                                                default:
                                                    Log.Warning($"Shouldn't hit this Action={message.Action}");
                                                    break;
                                            }

                                            break;
                                        }
                                    case "codestream:interaction:context-state-changed":
                                    case "mute-all":
                                        {
                                            // noops
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
                                                var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
                                                if (ideService != null)
                                                {
                                                    var editorResponse = ideService.OpenEditor(
                                                        fromMarkerResponse.TextDocument.Uri.ToUri(),
                                                        fromMarkerResponse.Range?.Start?.Line + 1);

                                                    _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, editorResponse.ToString()));
                                                }
                                            }
                                            break;
                                        }

                                    default:
                                        {
                                            string payloadResponse = null;
                                            string errorResponse = null;

                                            try
                                            {
                                                var response = await _codeStreamAgent.SendAsync<JToken>(message.Action, message.Params);
                                                payloadResponse = response.ToString();
                                            }
                                            catch (Exception ex)
                                            {
                                                Log.Verbose(ex, $"{nameof(WebViewRouter)} Action={message.Action}");
                                                errorResponse = ex.Message;
                                            }
                                            _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, payloadResponse, errorResponse));
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
