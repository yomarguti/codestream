using CodeStream.VisualStudio.Browsers;
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
        private IBrowser browser;

        public CodeStreamCommandHandler(IBrowser browser)
        {
            this.browser = browser;
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

        public void Handle(WindowEventArgs e)
        {
            //guard againt possibly non JSON-like data
            if (e == null || e.Message == null || !e.Message.StartsWith("{"))
            {
                log.Verbose(e.Message, $"{nameof(WindowEventArgs)} not found");
                return;
            }            

            var message = ParseMessageSafe(JToken.Parse(e.Message));
 
            log.Debug(e.Message);
 
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
                case "codestream:interaction:changed-active-stream":
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
                                    Payload = CodestreamAgentService.Instance.SendAsync<object>(request.Action, request.Params).GetAwaiter().GetResult()
                                }
                            };
                            browser.PostMessage(response);
                        }
                        else
                        {
                            switch (request?.Action)
                            {
                                case "bootstrap":
                                    {
                                        var response = new WebviewIpcMessageResponse
                                        {
                                            Body = new WebviewIpcMessageResponseBody(request?.Id)
                                            {
                                                Payload = new WebviewIpcMessageResponsePayload
                                                {
                                                    Configs = new Config(),
                                                    Services = new Service(),
                                                }
                                            }
                                        };

                                        browser.PostMessage(response);
                                        break;
                                    }
                                case "authenticate":
                                    {
                                        var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                        var response = new WebviewIpcMessageResponse
                                        {
                                            Body = new WebviewIpcMessageResponseBody(request?.Id)
                                        };

                                        using (sessionService.AgentReady())
                                        {
                                            var loginResponsewrapper = CodestreamAgentService.Instance.LoginAsync(
                                                request.Params["email"].ToString(),
                                                request.Params["password"].ToString(),
                                                Constants.ServerUrl
                                               ).GetAwaiter().GetResult();

                                            var error = loginResponsewrapper.Value<string>("error");
                                            if (error != null)
                                            {
                                                response.Body.Payload = error;
                                            }
                                            else
                                            {
                                                var loginResponse = loginResponsewrapper.ToObject<LoginResponseResponse>();
                                                var state = loginResponsewrapper.Value<JToken>().ToObject<StateResponse>();

                                                sessionService.LoginResponse = loginResponse.LoginResponse;
                                                sessionService.State = state.State;

                                                response.Body.Payload = CodestreamAgentService.Instance.GetBootstrapAsync(state).GetAwaiter().GetResult();
                                            }
                                            browser.PostMessage(response);
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
                                            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                            var browserService = Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                            browserService.Navigate($"{Constants.WebAppUrl}/signup?force_auth=true&signup_token={sessionService.GenerateSignupToken()}");
                                            response.Body.Payload = true;
                                        }
                                        catch (Exception ex)
                                        {
                                            response.Body.Error = ex.ToString();
                                        }
                                        browser.PostMessage(response);
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
                                            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                            var browserService = Package.GetGlobalService(typeof(SHostService)) as IHostService;
                                            browserService.Navigate($"{Constants.WebAppUrl}/service-auth/slack?state={sessionService.GenerateSignupToken()}");
                                            response.Body.Payload = true;
                                        }
                                        catch (Exception ex)
                                        {
                                            response.Body.Error = ex.ToString();
                                        }
                                        browser.PostMessage(response);
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
    }
}
