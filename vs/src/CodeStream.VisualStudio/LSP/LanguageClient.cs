using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Newtonsoft.Json.Serialization;
using Serilog;
using SerilogTimings.Extensions;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics.Contracts;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.LSP
{
    public interface ICodeStreamLanguageClient { }

    public interface SCodeStreamLanguageClient { }

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
    [Guid(Guids.LanguageClientId)]
    public class LanguageClient : ILanguageClient, ILanguageClientCustomMessage
    {
        private static readonly ILogger Log = LogManager.ForContext<LanguageClient>();

        private readonly ILanguageServerProcess _languageServerProcess;

        public event AsyncEventHandler<EventArgs> StartAsync;
#pragma warning disable 0067
        public event AsyncEventHandler<EventArgs> StopAsync;
#pragma warning restore 0067

#if DEBUG
        /// <summary>
        /// This is how we can see a list of contentTypes (used to generate the attrs for this class)
        /// </summary>
        [Import]
        internal IContentTypeRegistryService ContentTypeRegistryService { get; set; }
#endif

        public LanguageClient() : this(new LanguageServerProcess())
        {

        }

        public LanguageClient(ILanguageServerProcess languageServerProcess)
        {
            Instance = this;
            _languageServerProcess = languageServerProcess;
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
#if DEBUG
                    TraceLevel = "verbose",
                    IsDebugging = true,
#endif
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
        
        public object CustomMessageTarget => null;

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            await System.Threading.Tasks.Task.Yield();

            Connection connection = null;

            var process = _languageServerProcess.Create();

            using (Log.TimeOperation($"Starting server process. FileName={{FileNameAttribute}} Arguments={{Arguments}}", process.StartInfo.FileName, process.StartInfo.Arguments))
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

            // Slight hack to use camelCased properties when serializing requests
            _rpc.JsonSerializer.ContractResolver = new CamelCasePropertyNamesContractResolver();
        }

        public async System.Threading.Tasks.Task OnLoadedAsync()
        {
            using (Log.TimeOperation($"{nameof(OnLoadedAsync)}"))
            {
                await StartAsync?.InvokeAsync(this, EventArgs.Empty);
            }
        }

        public async System.Threading.Tasks.Task OnServerInitializedAsync()
        {
            try
            {
                using (Log.TimeOperation($"{nameof(OnServerInitializedAsync)}"))
                {
                    var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                    var codeStreamAgentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;

                    await codeStreamAgentService.SetRpcAsync(_rpc);
                    sessionService.SetAgentReady();

                    var ea = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
                    Contract.Assume(ea != null);
                    ea.Publish(new LanguageServerReadyEvent() { IsReady = true });
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, nameof(OnServerInitializedAsync));
                throw ex;
            }
            await System.Threading.Tasks.Task.CompletedTask;
        }

        public System.Threading.Tasks.Task OnServerInitializeFailedAsync(Exception ex)
        {
            Log.Error(ex, nameof(OnServerInitializeFailedAsync));
            throw ex;
        }
    }
}
