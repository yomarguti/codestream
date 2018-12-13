using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio
{
    [ContentType("CSharp")]
    [Export(typeof(ILanguageClient))]
    public class FooLanguageClient : ILanguageClient, ILanguageClientCustomMessage
    {
        static readonly ILogger log = LogManager.ForContext<FooLanguageClient>();

        internal const string UiContextGuidString = "DE885E15-D44E-40B1-A370-45372EFC23AA";
        private Guid _uiContextGuid = new Guid(UiContextGuidString);

        public event AsyncEventHandler<EventArgs> StartAsync;
#pragma warning disable 0067
        public event AsyncEventHandler<EventArgs> StopAsync;
#pragma warning restore 0067

        //[Import]
        //internal IContentTypeRegistryService ContentTypeRegistryService { get; set; }

        public FooLanguageClient()
        {
            Instance = this;
        }

        // IServiceProvider serviceProvider;
        //[ImportingConstructor]
        //public FooLanguageClient([Import(AllowDefault = true)]IServiceProvider serviceProvider)
        //    : base()
        //{
        //    Instance = this;
        //    this.serviceProvider = serviceProvider;
        //}

        internal static FooLanguageClient Instance { get; set; }
        internal JsonRpc Rpc { get; set; }
        public string Name => "CodeStream (Agent)";

        public IEnumerable<string> ConfigurationSections
        {
            get
            {
                yield return "CodeStream";
            }
        }

        public object InitializationOptions
        {
            get
            {
                return new InitializationOptions
                {
                    //serverUrl = "https://pd-api.codestream.us:9443",
                    // gitPath = "",
                    //type = "credentials",
                    //email = "",
                    //passwordOrToken = "",
                    //extension = new
                    //{
                    //    build = "0",
                    //    buildEnv = "0",
                    //    version = "0",
                    //    versionFormatted = "0",
                    //},
                    //traceLevel = "verbose"
                    //isDebugging = true,
                    //ide = new
                    //{
                    //    name = "Visual Studio",
                    //    version = "2017"
                    //},
                    //proxy = new
                    //{
                    //    url = (string)null,
                    //    strictSSL = false
                    //}

                };
            }
        }

        public IEnumerable<string> FilesToWatch => null;

        public object MiddleLayer => MiddleLayerProvider.Instance;

        private class MiddleLayerProvider : ILanguageClientWorkspaceSymbolProvider
        {
            internal readonly static MiddleLayerProvider Instance = new MiddleLayerProvider();

            private MiddleLayerProvider()
            {
            }

            public async Task<SymbolInformation[]> RequestWorkspaceSymbols(WorkspaceSymbolParams param, Func<WorkspaceSymbolParams, Task<SymbolInformation[]>> sendRequest)
            {
                // Send along the request as given
                SymbolInformation[] symbols = await sendRequest(param);

                return symbols;
            }

        }

        public object CustomMessageTarget => new CustomTarget();

        private async Task<Connection> ActivateByStdIOAsync(CancellationToken token)
        {
            await System.Threading.Tasks.Task.Yield();

            //TODO package up node?
            var info = new ProcessStartInfo
            {
                FileName = @"C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
            };
            ////TODO package this up?
            //var agent = @"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.js";
            //var info = new ProcessStartInfo
            //{
            //    FileName = @"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.exe"
            //};
            //TODO package this up?
            var agent = @"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.js";
            info.Arguments = $@"{agent} --stdio --inspect=6009 --nolazy";
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;

            var process = new Process
            {
                StartInfo = info
            };

            if (process.Start())
            {
                return new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
            }

            throw new Exception("Process start exception");
        }

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            return await ActivateByStdIOAsync(token);
        }

        public async System.Threading.Tasks.Task AttachForCustomMessageAsync(JsonRpc rpc)
        {
            await System.Threading.Tasks.Task.Yield();
            this.Rpc = rpc;

            //await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            ////// Sets the UI context so the custom command will be available.
            //var monitorSelection = ServiceProvider.GlobalProvider.GetService(typeof(IVsMonitorSelection)) as IVsMonitorSelection;
            //if (monitorSelection != null)
            //{
            //    if (monitorSelection.GetCmdUIContextCookie(ref this._uiContextGuid, out uint cookie) == VSConstants.S_OK)
            //    {
            //        monitorSelection.SetCmdUIContext(cookie, 1);
            //    }
            //}

            // [BC] does this actually work?
            //this.Rpc.AddLocalRpcTarget()
        }

        public async System.Threading.Tasks.Task OnLoadedAsync()
        {
            log.Verbose(nameof(OnLoadedAsync));
            await StartAsync?.InvokeAsync(this, EventArgs.Empty);
        }

        public async System.Threading.Tasks.Task OnServerInitializedAsync()
        {
            try
            {
                
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                var initialized = await CodestreamAgentService.Instance.SetRpcAsync(Rpc);
                sessionService.Capabilities = initialized;
                sessionService.SetAgentReady();
                log.Verbose(nameof(OnServerInitializedAsync));
            }
            catch (Exception ex)
            {
                log.Error(ex, nameof(OnServerInitializedAsync));
                throw ex;
            }
            await System.Threading.Tasks.Task.CompletedTask;
        }

        public System.Threading.Tasks.Task OnServerInitializeFailedAsync(Exception ex)
        {
            log.Error(ex, nameof(OnServerInitializeFailedAsync));
            throw ex;
        }
    }

    public class CustomTarget
    {
        public void OnCustomNotification(object arg)
        {
            // Provide logic on what happens OnCustomNotification is called from the language server
        }

        public string OnCustomRequest(string test)
        {
            // Provide logic on what happens OnCustomRequest is called from the language server
            return null;
        }

        [JsonRpcMethod(Methods.InitializeName)]
        public void OnInitialize(object arg)
        {
            //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
            //server.OnTextDocumentOpened(parameter);
        }

        [JsonRpcMethod(Methods.InitializedName)]
        public void OnInitialized(object arg)
        {
            //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
            //server.OnTextDocumentOpened(parameter);
        }

        [JsonRpcMethod("codestream/foo")]
        public object CodestreamS(object arg)
        {
            return null;
        }

        [JsonRpcMethod("codeStream/ping")]
        public object Ping(object arg)
        {
            return null;
        }

        [JsonRpcMethod("codeStream/teams")]
        public object CodestreamTeams(object arg)
        {
            return null;
        }

        [JsonRpcMethod(Methods.TextDocumentDidOpenName)]
        public void OnTextDocumentOpened(object arg)
        {
            //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
            //server.OnTextDocumentOpened(parameter);
        }

        [JsonRpcMethod(Methods.TextDocumentPublishDiagnosticsName)]
        public void TextDocumentPublishDiagnosticsName(object arg)
        {
            //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
            //server.OnTextDocumentOpened(parameter);
        }

        [JsonRpcMethod("window/logMessage")]
        public void Log(string s)
        {
            Console.WriteLine(s);
        }
    }
}
