using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using DotNetBrowser;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Windows;
using System.Windows.Controls;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// Interaction logic for CodeStreamToolWindowControl.
    /// </summary>
    public partial class CodeStreamToolWindowControl : UserControl
    {
        private CodeStreamMessage ParseMessage(JToken token)
        {
            var type = token.Value<string>("type");

            return new CodeStreamMessage()
            {
                Type = type,
                Body = token.Value<JToken>("body")
            };

        }
        static readonly ILogger log = LogManager.ForContext<CodeStreamToolWindowControl>();

        /// <summary>
        /// Initializes a new instance of the <see cref="CodeStreamToolWindowControl"/> class.
        /// </summary>
        public CodeStreamToolWindowControl()
        {
            BrowserPreferences.SetChromiumSwitches("--remote-debugging-port=9222", "--disable-web-security", "--allow-file-access-from-files");

            this.InitializeComponent();

            var dir = Directory.GetCurrentDirectory();
            var harness = System.IO.File.ReadAllText($"{dir}/webview.html");
            harness = harness.Replace("{root}", dir.Replace(@"\", "/"));
            harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{File.ReadAllText($"{dir}/Themes/dark.css")}</style>");

            Browser.Browser.ConsoleMessageEvent += delegate (object sender, DotNetBrowser.Events.ConsoleEventArgs e)
            {
                // Task.Run(new Action( () =>
                {
                    if (e == null || e.Message == null || e.Level != DotNetBrowser.Events.ConsoleEventArgs.MessageLevel.LOG ||
                    !e.Message.StartsWith("{")) return;

                    var data = ParseMessage(JToken.Parse(e.Message));
                    log.Debug(e.Message);
                    switch (data.Type)
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
                                var request = data;
                                switch (request?.Action)
                                {
                                    case "bootstrap":
                                        {
                                            var response = new
                                            {
                                                Type = "codestream:response",
                                                Body = new
                                                {
                                                    Id = request?.Id,
                                                    Payload = new
                                                    {
                                                        Env = (string)null,
                                                        Configs = new { Email = (string)null },
                                                        Services = new { },
                                                        Version = (string)null,
                                                    }
                                                }
                                            };
                                            Browser.Browser.ExecuteJavaScript(@"window.postMessage(" + response.ToJson() + @",""*"");");
                                            break;
                                        }
                                    case "authenticate":
                                        {
                                            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Type = "codestream:response",
                                                Body = new WebviewIpcMessageResponseBody
                                                {
                                                    Id = request?.Id
                                                }
                                            };
                                            try
                                            {
                                                if (sessionService.SessionState == SessionState.AgentReady)
                                                {
                                                    var loginResponse = CodestreamAgentApi.Instance.LoginAsync(
                                                        request.Params["email"].ToString(),
                                                        request.Params["password"].ToString(),
                                                        Constants.ServerUrl
                                                       ).GetAwaiter().GetResult();

                                                    var error = loginResponse.Value<string>("error");
                                                    if (error != null)
                                                    {
                                                        response.Body.Payload = error;
                                                    }
                                                    else
                                                    {
                                                        var foo = loginResponse.ToObject<LoginResponseResponse>();
                                                        var state = loginResponse.Value<JToken>().ToObject<StateResponse>();
                                                        sessionService.LoginResponse = foo.LoginResponse;
                                                        sessionService.State = state.State;

                                                        response.Body.Payload = CodestreamAgentApi.Instance.GetBootstrapAsync(state).GetAwaiter().GetResult();
                                                    }
                                                    Browser.Browser.ExecuteJavaScript(@"window.postMessage(" + response.ToJson() + @",""*"");");
                                                }
                                                else
                                                {
                                                    //nuttin yet
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                log.Error(ex, "Authentication");
                                            }
                                          
                                            break;
                                        }
                                    case "validate-signup":
                                    case "create-post":
                                        {
                                            break;
                                        }
                                    case "fetch-posts":
                                        {
                                            var response = new WebviewIpcMessageResponse
                                            {
                                                Type = "codestream:response",
                                                Body = new WebviewIpcMessageResponseBody
                                                {
                                                    Id = request?.Id,
                                                    Payload = CodestreamAgentApi.Instance.GetPostsAsync(request.Params["streamId"]?.ToString()).GetAwaiter().GetResult()
                                                }
                                            };

                                            Browser.Browser.ExecuteJavaScript(@"window.postMessage(" + response.ToJson() + @",""*"");");
                                            break;
                                        }
                                    case "fetch-thread":
                                        {
                                            break;
                                        }
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
                                            var resp = new WebviewIpcMessageResponseBody
                                            {
                                                Id = request?.Id
                                            };
                                            try
                                            {
                                                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                                var browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
                                                browserService.Navigate($"{Constants.WebAppUrl}/signup?force_auth=true&signup_token={sessionService.GenerateSignupToken()}");
                                                resp.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                resp.Error = ex.ToString();
                                            }
                                            resp.Type = "codestream:response";
                                            Browser.Browser.ExecuteJavaScript(@"window.postMessage(" + resp.ToJson() + @",""*"");");
                                            break;
                                        }
                                    case "go-to-slack-signin":
                                        {
                                            var resp = new WebviewIpcMessageResponseBody
                                            {
                                                Id = request?.Id
                                            };
                                            try
                                            {
                                                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                                                var browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
                                                browserService.Navigate($"{Constants.WebAppUrl}/service-auth/slack?state={sessionService.GenerateSignupToken()}");
                                                resp.Payload = true;
                                            }
                                            catch (Exception ex)
                                            {
                                                resp.Error = ex.ToString();
                                            }
                                            resp.Type = "codestream:response";
                                            Browser.Browser.ExecuteJavaScript(@"window.postMessage(" + resp.ToJson() + @",""*"");");
                                            break;
                                        }

                                    default:
                                        log.Debug("Unknown Action={Action}", request?.Action);
                                        break;
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
                //));
            };

            Browser.Browser.LoadHTML(harness);

        }

        private void Browser_Initialized(object sender, EventArgs e)
        {

        }

        private void Browser_FinishLoadingFrameEvent(object sender, DotNetBrowser.Events.FinishLoadingEventArgs e)
        {
            if (e.IsMainFrame)
            {
                //DOMDocument document = e.Browser.GetDocument();
                //List<DOMNode> inputs = document.GetElementsByTagName("body");
                //var body = inputs[0] as DOMElement;                
                //body.SetAttribute("style", "--app-background-color:green;");
                //var f = Browser.Browser.CreateEvent("message");

                //body.AddEventListener(f, OnMessage, false);
                //foreach (DOMNode node in inputs)
                //{
                //    DOMElement element = node as DOMElement;
                //    if (element.GetAttribute("type").ToLower().Equals("submit"))
                //    {
                //        element.AddEventListener(DOMEventType.OnClick, OnSubmitClicked, false);
                //    }
                //}
            }
        }


        /// <summary>
        /// Handles click on the button by displaying a message box.
        /// </summary>
        /// <param name="sender">The event sender.</param>
        /// <param name="e">The event args.</param>
        [SuppressMessage("Microsoft.Globalization", "CA1300:SpecifyMessageBoxOptions", Justification = "Sample code")]
        [SuppressMessage("StyleCop.CSharp.NamingRules", "SA1300:ElementMustBeginWithUpperCaseLetter", Justification = "Default event handler naming pattern")]
        private void button1_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                string.Format(System.Globalization.CultureInfo.CurrentUICulture, "Invoked '{0}'", this.ToString()),
                "CodeStreamToolWindow");
        }
    }
}