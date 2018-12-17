using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Serilog;
using SerilogTimings.Extensions;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio
{
    [ContentType("FSharpInteractive")]
    [ContentType("RazorCoreCSharp")]
    [ContentType("RazorVisualBasic")]
    [ContentType("CoffeeScript")]
    [ContentType("CSharp")]
    [ContentType("mustache")]
    [ContentType("RazorCSharp")]
    [ContentType("JavaScript")]
    [ContentType("Python")]
    [ContentType("F#")]
    [ContentType("css")]
    [ContentType("XML")]
    [ContentType("C/C++")]
    [ContentType("vbscript")]
    [ContentType("TypeScript")]
    [ContentType("Dockerfile")]
    [ContentType("LESS")]
    [ContentType("jade")]
    [ContentType("JSON")]
    [ContentType("HTML")]
    [ContentType("SCSS")]
    [ContentType("XAML")]
    [Export(typeof(ILanguageClient))]
    public class LanguageClient : ILanguageClient, ILanguageClientCustomMessage
    {
        static readonly ILogger log = LogManager.ForContext<LanguageClient>();
        internal const string UiContextGuidString = "DE885E15-D44E-40B1-A370-45372EFC23AA";
        private Guid _uiContextGuid = new Guid(UiContextGuidString);
        private ILanguageServerProcess _languageServer;

        public event AsyncEventHandler<EventArgs> StartAsync;
#pragma warning disable 0067
        public event AsyncEventHandler<EventArgs> StopAsync;
#pragma warning restore 0067

#if DEBUG
        [Import]
        internal IContentTypeRegistryService ContentTypeRegistryService { get; set; }
#endif

        public LanguageClient() : this(new LanguageServerProcess())
        {

        }

        public LanguageClient(ILanguageServerProcess languageServer)
        {
            Instance = this;
            _languageServer = languageServer;
        }

        // IServiceProvider serviceProvider;
        //[ImportingConstructor]
        //public FooLanguageClient([Import(AllowDefault = true)]IServiceProvider serviceProvider)
        //    : base()
        //{
        //    Instance = this;
        //    this.serviceProvider = serviceProvider;
        //}

        internal static LanguageClient Instance { get; private set; }
        private JsonRpc _rpc;

        public string Name => "CodeStream";

        public IEnumerable<string> ConfigurationSections => null;
        //{
        //    get
        //    {
        //        yield return "CodeStream";
        //    }
        //}

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

        public object MiddleLayer => null;

        private static CustomTarget _target;
        public object CustomMessageTarget
        {
            get
            {
                if (_target == null)
                {
                    _target = new CustomTarget();
                }

                return _target;
            }
        }

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            await System.Threading.Tasks.Task.Yield();

            Connection connection = null;

            var process = _languageServer.Create();

            using (log.TimeOperation($"Starting server process. FileName={{FileNameAttribute}} Arguments={{Arguments}}", process.StartInfo.FileName, process.StartInfo.Arguments))
            {
                if (process.Start())
                {
                    connection = new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
                }
            }

            return connection;
        }

        public async System.Threading.Tasks.Task AttachForCustomMessageAsync(JsonRpc rpc)
        {
            await System.Threading.Tasks.Task.Yield();
            _rpc = rpc;

            //await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            // Sets the UI context so the custom command will be available.
            //var monitorSelection = ServiceProvider.GlobalProvider.GetService(typeof(IVsMonitorSelection)) as IVsMonitorSelection;
            //if (monitorSelection != null)
            //{
            //    if (monitorSelection.GetCmdUIContextCookie(ref this._uiContextGuid, out uint cookie) == VSConstants.S_OK)
            //    {
            //        monitorSelection.SetCmdUIContext(cookie, 1);
            //    }
            //}
        }

        public async System.Threading.Tasks.Task OnLoadedAsync()
        {
            using (log.TimeOperation($"{nameof(OnLoadedAsync)}"))
            {
                await StartAsync?.InvokeAsync(this, EventArgs.Empty);
            }
        }

        public async System.Threading.Tasks.Task OnServerInitializedAsync()
        {
            try
            {
                using (log.TimeOperation($"{nameof(OnServerInitializedAsync)}"))
                {
                    var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                    var codeStreamAgentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;

                    var initialized = await codeStreamAgentService.SetRpcAsync(_rpc);
                    sessionService.Capabilities = initialized;
                    sessionService.SetAgentReady();
                }
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

    //public class CustomTarget2
    //{
    //    public void OnCustomNotification(object arg)
    //    {
    //        // Provide logic on what happens OnCustomNotification is called from the language server
    //    }

    //    public string OnCustomRequest(string test)
    //    {
    //        // Provide logic on what happens OnCustomRequest is called from the language server
    //        return null;
    //    }

    //    [JsonRpcMethod(Methods.InitializeName)]
    //    public void OnInitialize(object arg)
    //    {
    //        //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
    //        //server.OnTextDocumentOpened(parameter);
    //    }

    //    [JsonRpcMethod(Methods.InitializedName)]
    //    public void OnInitialized(object arg)
    //    {
    //        //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
    //        //server.OnTextDocumentOpened(parameter);
    //    }

    //    [JsonRpcMethod(Methods.TextDocumentDidOpenName)]
    //    public void OnTextDocumentOpened(object arg)
    //    {
    //        //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
    //        //server.OnTextDocumentOpened(parameter);
    //    }

    //    [JsonRpcMethod(Methods.TextDocumentPublishDiagnosticsName)]
    //    public void TextDocumentPublishDiagnosticsName(object arg)
    //    {
    //        //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
    //        //server.OnTextDocumentOpened(parameter);
    //    }

    //    [JsonRpcMethod("window/logMessage")]
    //    public void Log(string s)
    //    {
    //        Console.WriteLine(s);
    //    }
    //}

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

        [JsonRpcMethod(Methods.TextDocumentDidSaveName)]
        public void OnTextDocumentDidSaveName(object arg)
        {
            //  var parameter = arg.ToObject<DidOpenTextDocumentParams>();
            //server.OnTextDocumentOpened(parameter);
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
