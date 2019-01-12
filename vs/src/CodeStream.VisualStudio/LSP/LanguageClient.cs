using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Newtonsoft.Json.Serialization;
using Serilog;
using SerilogTimings.Extensions;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.LSP
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
        private readonly IEventAggregator _eventAggregator;
        private readonly ISettingsService _settingsService;
        private readonly ICodeStreamAgentService _codeStreamAgentService;
        private readonly ISessionService _sessionService;

        [ImportingConstructor]
        public LanguageClient(IEventAggregator eventAggregator, ISettingsService settingsService, ICodeStreamAgentService codeStreamAgentService, 
            ISessionService sessionService) : this(new LanguageServerProcess())
        {
            _eventAggregator = eventAggregator;
            _settingsService = settingsService;
            _codeStreamAgentService = codeStreamAgentService;
            _sessionService = sessionService;
        }

        public LanguageClient(ILanguageServerProcess languageServerProcess)
        {
            Instance = this;
            _languageServerProcess = languageServerProcess;
        }

        internal static LanguageClient Instance { get; private set; }
        private JsonRpc _rpc;

        public string Name => Application.Name;

        public IEnumerable<string> ConfigurationSections => null;

        public object InitializationOptions
        {
            get
            {
                return new InitializationOptions
                {
                    Extension = _settingsService.GetExtensionInfo(),
                    Ide = _settingsService.GetIdeInfo(),
#if DEBUG
                    TraceLevel = TraceLevel.Verbose.ToJsonValue(),
                    IsDebugging = true
#else
                    TraceLevel = _settingsService.TraceLevel.ToJsonValue(),
#endif

                };
            }
        }

        public IEnumerable<string> FilesToWatch => null;

        public object MiddleLayer => null;
        
        public object CustomMessageTarget => null;

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            await Task.Yield();

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

        public async Task AttachForCustomMessageAsync(JsonRpc rpc)
        {
            await Task.Yield();
            _rpc = rpc;

            // Slight hack to use camelCased properties when serializing requests
            _rpc.JsonSerializer.ContractResolver = new CamelCasePropertyNamesContractResolver();
        }

        public async Task OnLoadedAsync()
        {
            using (Log.TimeOperation($"{nameof(OnLoadedAsync)}"))
            {
                // ReSharper disable once PossibleNullReferenceException
                await StartAsync?.InvokeAsync(this, EventArgs.Empty);
            }
        }

        public async Task OnServerInitializedAsync()
        {
            try
            {
                using (Log.TimeOperation($"{nameof(OnServerInitializedAsync)}"))
                {
                    await _codeStreamAgentService.SetRpcAsync(_rpc);
                    _sessionService.SetAgentReady();
                    _eventAggregator.Publish(new LanguageServerReadyEvent { IsReady = true });
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, nameof(OnServerInitializedAsync));
                throw;
            }
            await Task.CompletedTask;
        }

        public Task OnServerInitializeFailedAsync(Exception ex)
        {
            Log.Error(ex, nameof(OnServerInitializeFailedAsync));
            throw ex;
        }
    }
}
