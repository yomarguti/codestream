using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using System;

namespace CodeStream.VisualStudio
{
    public class CodeStreamCommandHandler
    {
        static readonly ILogger log = LogManager.ForContext<CodeStreamCommandHandler>();

        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browser;

        public CodeStreamCommandHandler(IEventAggregator eventAggregator, IBrowserService browser)
        {
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
                log.Error(ex, "Token could not be parsed. Type={Type}", type);
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
            //guard againt possibly non JSON-like data
            if (e == null || e.Message == null || !e.Message.StartsWith("{"))
            {
                log.Verbose(e.Message, $"{nameof(WindowEventArgs)} not found");
            }
            else
            {               
                var message = ParseMessageSafe(JToken.Parse(e.Message));

                log.Debug(e.Message);

                var codeStreamAgent = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

                switch (message.Type)
                {
                    case "codestream:log":
                        {
                            log.Debug(e.Message);
                            break;
                        }
                    case "codestream:telemetry":
                    case "codestream:interaction:clicked-reload-webview":
                    case "codestream:interaction:thread-closed":
                    case "codestream:interaction:active-panel-changed":
                        {
                            break;
                        }
                    case "codestream:interaction:thread-selected":
                    case "codestream:interaction:svc-request":
                    case "codestream:subscription:file-changed":
                    case "codestream:unsubscribe:file-changed":
                        {
                            break;
                        }
                    case "codestream:interaction:changed-active-stream":
                        {
                            sessionService.CurrentStreamId = message.Body.ToString();
                            break;
                        }
                    case "codestream:view-ready":
                        {
                            break;
                        }
                    case "codestream:request":
                        {
                            var request = message;
                            if (request.Action.StartsWith("codeStream/"))
                            {
                                var response = new WebviewIpcMessageResponse
                                {
                                    Body = new WebviewIpcMessageResponseBody(request?.Id)
                                    {
                                        Payload = await codeStreamAgent.SendAsync<object>(request.Action, request.Params)
                                    }
                                };
                                _browser.PostMessage(response);
                            }
                            else
                            {
                                switch (request?.Action)
                                {
                                    case "bootstrap":
                                        {
                                            var settings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(request?.Id)
                                                {
                                                    Payload = new WebviewIpcMessageResponsePayload
                                                    {
                                                        Configs = new Config()
                                                        {
                                                            Email = settings?.Email
                                                        },
                                                        Services = new Service(),
                                                    }
                                                }
                                            };

                                            _browser.PostMessage(response);
                                            break;
                                        }
                                    case "authenticate":
                                        {
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(request?.Id)
                                            };

                                            using (sessionService.AgentReady())
                                            {
                                                string email = request.Params["email"].ToString();
                                                var loginResponsewrapper = await codeStreamAgent.LoginAsync(
                                                    email,
                                                    request.Params["password"].ToString(),
                                                    Constants.ServerUrl
                                                   );

                                                var error = loginResponsewrapper.Value<string>("error");
                                                if (error != null)
                                                {
                                                    response.Body.Payload = error;
                                                }
                                                else
                                                {
                                                    var loginResponse = loginResponsewrapper.ToObject<LoginResponseWrapper>();                                                  
                                                    sessionService.LoginResponse = loginResponse.Result.LoginResponse;
                                                    sessionService.State = loginResponse.Result.State;

                                                    response.Body.Payload = await codeStreamAgent.GetBootstrapAsync(loginResponse.Result.State);
                                                    sessionService.SetUserReady();
                                                    _eventAggregator.Publish(new SessionReadyEvent());
                                                }
                                                _browser.PostMessage(response);

                                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                                                using (var scope = SettingsScope.Create(Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService))
                                                {
                                                    scope.SettingsService.Email = email;
                                                }                                                 
                                            }
                                            break;
                                        }
                                    case "validate-signup":
                                        {
                                            //TODO
                                            //var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                            //if (sessionService.SessionState == SessionState.AgentReady)
                                            //{
                                            //    var response = new WebviewIpcMessageResponse
                                            //    {
                                            //        Body = new WebviewIpcMessageResponseBody(request?.Id)
                                            //    };

                                            //    var loginResponsewrapper = CodestreamAgentService.Instance.LoginViaTokenAsync(
                                            //        request.Params["token"].ToString(),                                                
                                            //        Constants.ServerUrl
                                            //       ).GetAwaiter().GetResult();

                                            //    var error = loginResponsewrapper.Value<string>("error");
                                            //    if (error != null)
                                            //    {
                                            //        response.Body.Payload = error;
                                            //    }
                                            //    else
                                            //    {
                                            //        var loginResponse = loginResponsewrapper.ToObject<LoginResponseResponse>();
                                            //        var state = loginResponsewrapper.Value<JToken>().ToObject<StateResponse>();

                                            //        sessionService.LoginResponse = loginResponse.LoginResponse;
                                            //        sessionService.State = state.State;

                                            //        response.Body.Payload = CodestreamAgentService.Instance.GetBootstrapAsync(state).GetAwaiter().GetResult();
                                            //    }
                                            //    browser.PostMessage(response);
                                            //}
                                            //else
                                            //{
                                            //    //nuttin yet
                                            //}
                                            break;
                                        }
                                    case "create-post":
                                    case "fetch-posts":
                                    case "fetch-thread":
                                    case "delete-post":
                                    case "edit-codemark":
                                    case "mute-all":
                                    case "open-comment-on-select":
                                    case "create-stream":
                                    case "open-stream":
                                    case "leave-stream":
                                    case "rename-stream":
                                    case "set-stream-purpose":
                                    case "archive-stream":
                                    case "remove-users-from-stream":
                                    case "add-users-to-stream":
                                    case "close-direct-message":
                                    case "change-stream-mute-state":
                                    case "show-code":
                                    case "invite":
                                    case "save-user-preference":
                                    case "join-stream":
                                    case "set-codemark-status":
                                    case "mark-stream-read":
                                    case "show-markers":
                                    case "mark-post-unread":
                                    case "edit-post":
                                    case "react-to-post":
                                    case "fetch-codemarks":
                                        {
                                            break;
                                        }
                                    case "go-to-signup":
                                        {
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(request?.Id)
                                            };

                                            try
                                            {
                                                var browserService = Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                                //TODO move out of Constants
                                                browserService.Navigate($"{Constants.WebAppUrl}/signup?force_auth=true&signup_token={sessionService.GenerateSignupToken()}");
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
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Body = new WebviewIpcMessageResponseBody(request?.Id)
                                            };

                                            try
                                            {
                                                var browserService = Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                                //TODO move out of Constants
                                                browserService.Navigate($"{Constants.WebAppUrl}/service-auth/slack?state={sessionService.GenerateSignupToken()}");
                                                response.Body.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                response.Body.Error = ex.ToString();
                                            }
                                            _browser.PostMessage(response);
                                            break;
                                        }

                                    default:
                                        log.Debug("Unknown Action={Action}", request?.Action);
                                        break;
                                }
                            }

                            break;
                        }
                    default:
                        {
                            log.Debug("Unknown Message={Message}", e.Message);
                            break;
                        }
                }
            }

            await System.Threading.Tasks.Task.CompletedTask;
        }
    }
}
