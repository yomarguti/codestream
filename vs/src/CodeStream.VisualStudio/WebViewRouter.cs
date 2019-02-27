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
using System.Net.Http;
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

        //
        //
        //TODO use DI in the ctor rather than inline Package/ServiceLocator pattern?
        //
        //

        public async System.Threading.Tasks.Task HandleAsync(WindowEventArgs e)
        {
            try
            {
                //guard against possibly non JSON-like data
                if (e?.Message == null || !e.Message.StartsWith("{"))
                {
                    Log.Verbose($"{nameof(HandleAsync)} not found => {e?.Message}");
                }
                else
                {
                    var message = WebviewIpcMessage.Parse(e.Message);
                    Log.Verbose(e.Message);

                    var target = message.Target();
                    switch (target)
                    {
                        case "codeStream":
                            {
                                string responseString = null;
                                string errorMessage = null;

                                try
                                {
                                    var response = await _codeStreamAgent.SendAsync<JToken>(message.Method, message.Params);
                                    responseString = response.ToString();
                                }
                                catch (Exception ex)
                                {
                                    Log.Verbose(ex, $"Method={message.Method}");
                                    errorMessage = ex.Message;
                                }
                                _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, responseString, errorMessage));
                                break;
                            }
                        case "extension":
                            {
                                switch (message.Method)
                                {
                                    case WebviewReadyNotificationType.MethodName:
                                        {
                                            // ready -- nothing to do!
                                            break;
                                        }
                                    case DidOpenThreadNotificationType.MethodName:
                                    case DidCloseThreadNotificationType.MethodName:
                                    case DidChangeContextStateNotificationType.MethodName:
                                    case ShowDiffRequestType.MethodName:
                                    case ApplyPatchRequestType.MethodName:
                                    case StartCommentOnLineRequestType.MethodName:
                                    case RevealFileLineRequestType.MethodName:
                                    case HighlightCodeRequestType.MethodName:
                                        {
                                            //noop
                                            break;
                                        }
                                    case GetViewBootstrapDataRequestType.MethodName:
                                    case LoginRequestType.MethodName:
                                    case StartSignupRequestType.MethodName:
                                    case GoToSlackSigninRequestType.MethodName:
                                    case ValidateSignupRequestType.MethodName:
                                        {
                                            var authenticationController = new AuthenticationController(
                                                _settingsService,
                                                _sessionService,
                                                _codeStreamAgent,
                                                _eventAggregator,
                                                _browserService,
                                                _ideService,
                                                _credentialsService);

                                            switch (message.Method)
                                            {
                                                case GetViewBootstrapDataRequestType.MethodName:
                                                    await authenticationController.BootstrapAsync(message.Id);
                                                    break;
                                                case LoginRequestType.MethodName:
                                                    await authenticationController.AuthenticateAsync(message.Id, message.Params["email"].ToString(), message.Params["password"].ToString());
                                                    break;
                                                case StartSignupRequestType.MethodName:
                                                    await authenticationController.GoToSignupAsync(message.Id);
                                                    break;
                                                case GoToSlackSigninRequestType.MethodName:
                                                    await authenticationController.GoToSlackSigninAsync(message.Id);
                                                    break;
                                                case ValidateSignupRequestType.MethodName:
                                                    await authenticationController.ValidateSignupAsync(message.Id, message.Params?.Value<string>());
                                                    break;
                                                default:
                                                    Log.Warning($"Shouldn't hit this Method={message.Method}");
                                                    break;
                                            }
                                            break;
                                        }
                                    case SignOutRequestType.MethodName:
                                        {
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
                                            var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
                                            if (codeStreamService != null)
                                            {
                                                await codeStreamService.LogoutAsync();
                                            }
                                            break;
                                        }
                                    case ShowCodeRequestType.MethodName:
                                        {
                                            var showCodeResponse = message.Params.ToObject<ShowCodeResponse>();

                                            var fromMarkerResponse = await _codeStreamAgent.GetDocumentFromMarkerAsync(
                                                new DocumentFromMarkerRequest
                                                {
                                                    File = showCodeResponse.Marker.File,
                                                    RepoId = showCodeResponse.Marker.RepoId,
                                                    MarkerId = showCodeResponse.Marker.Id,
                                                    Source = showCodeResponse.Source
                                                });

                                            if (fromMarkerResponse?.TextDocument?.Uri != null)
                                            {
                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
                                                if (_ideService != null)
                                                {
                                                    var editorResponse = _ideService.OpenEditor(
                                                        fromMarkerResponse.TextDocument.Uri.ToUri(),
                                                        fromMarkerResponse.Range?.Start?.Line + 1);

                                                    _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, editorResponse.ToString()));
                                                }
                                            }
                                            break;
                                        }
                                    case ReloadWebviewRequestType.MethodName:
                                        {
                                            _browserService.ReloadWebView();
                                            break;
                                        }
                                    case ShowMarkersInEditorRequestType.MethodName:
                                    case OpenCommentOnSelectInEditorRequestType.MethodName:
                                    case MuteAllConversationsRequestType.MethodName:
                                        {
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                            
                                            // NOTE: we're not using the controller here. changing these properties
                                            // triggers the OnPropertyChanged, which then uses the ConfigurationController
                                            // for added handling
                                            switch (message.Method)
                                            {
                                                case ShowMarkersInEditorRequestType.MethodName:
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.ShowMarkers = message.Params.ToObject<ShowMarkersInEditorRequestTypeParams>().Enable;
                                                    }

                                                    break;
                                                case OpenCommentOnSelectInEditorRequestType.MethodName:
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.OpenCommentOnSelect = message.Params.ToObject<OpenCommentOnSelectInEditorRequestTypeParams>().Enable;
                                                    }

                                                    break;
                                                case MuteAllConversationsRequestType.MethodName:
                                                    using (var scope = SettingsScope.Create(_settingsService))
                                                    {
                                                        scope.SettingsService.MuteAll = message.Params.ToObject<MuteAllConversationsRequestTypeParams>().Mute;
                                                    }
                                                    break;
                                                default:
                                                    Log.Warning($"Shouldn't hit this Method={message.Method}");
                                                    break;
                                            }

                                            _browserService.PostMessage(new WebviewIpcMessage(message.Id));
                                            break;
                                        }
                                    case StartLiveShareRequestType.MethodName:
                                    case InviteToLiveShareRequestType.MethodName:
                                    case JoinLiveShareRequestType.MethodName:
                                        {
                                            var liveShareAction = message.Params.ToObject<LiveShareAction>();

                                            var liveShareController = new LiveShareController(
                                                _sessionService,
                                                _codeStreamAgent,
                                                _eventAggregator,
                                                _browserService,
                                                _ideService);

                                            switch (message.Method)
                                            {
                                                case StartLiveShareRequestType.MethodName:
                                                    {
                                                        await liveShareController.StartAsync(liveShareAction.StreamId, liveShareAction.ThreadId);
                                                        break;
                                                    }
                                                case InviteToLiveShareRequestType.MethodName:
                                                    {
                                                        await liveShareController.InviteAsync(liveShareAction.UserId);
                                                        break;
                                                    }
                                                case JoinLiveShareRequestType.MethodName:
                                                    {
                                                        await liveShareController.JoinAsync(liveShareAction?.Url);
                                                        break;
                                                    }
                                                default:
                                                    {
                                                        Log.Verbose($"Unknown LiveShare method {message.Method}");
                                                        break;
                                                    }
                                            }
                                            break;
                                        }
                                    case DidChangeActiveStreamNotificationType.MethodName:
                                        {
                                            _sessionService.CurrentStreamId = message.Params.ToObject<DidChangeActiveStreamNotification>()?.StreamId;
                                            break;
                                        }
                                    default:
                                        {
                                            Log.Warning($"Unknown Target={target} Method={message.Method}");
                                            break;
                                        }
                                }
                                break;
                            }
                        default:
                        {
                            Log.Warning($"Unknown Target={target}");
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
