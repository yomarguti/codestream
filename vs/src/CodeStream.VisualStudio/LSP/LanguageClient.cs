using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using EnvDTE;
using EnvDTE80;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Serilog;
using SerilogTimings.Extensions;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Package = Microsoft.VisualStudio.Shell.Package;
using ThreadHelper = Microsoft.VisualStudio.Shell.ThreadHelper;

namespace CodeStream.VisualStudio.LSP
{
    /// <summary>
    /// NOTE: See ContentDefinitions.cs for the LanguageClient partial class attributes
    /// </summary>
    [Export(typeof(ILanguageClient))]
    [Guid(Guids.LanguageClientId)]
    public partial class LanguageClient : ILanguageClient, ILanguageClientCustomMessage
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
        public LanguageClient()
        {
            Instance = this;
            _eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
            _settingsService = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
            _codeStreamAgentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
            _sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            var ipc = Package.GetGlobalService(typeof(SWebviewIpc)) as IWebviewIpc;

            _languageServerProcess = new LanguageServerProcess();
            CustomMessageTarget = new CustomMessageHandler(_eventAggregator, ipc);
        }

        internal static LanguageClient Instance { get; private set; }
        private JsonRpc _rpc;

        public string Name => Application.Name;

        public IEnumerable<string> ConfigurationSections => null;

        public object InitializationOptions
        {
            get
            {
                var initializationOptions = new InitializationOptions
                {
                    Extension = _settingsService.GetExtensionInfo(),
                    Ide = _settingsService.GetIdeInfo(),
#if DEBUG
                    TraceLevel = TraceLevel.Verbose.ToJsonValue(),
                    IsDebugging = true,
#else
                    TraceLevel = _settingsService.TraceLevel.ToJsonValue(),
#endif
                    Proxy = _settingsService.Proxy,
                    ProxySupport = _settingsService.ProxySupport.ToJsonValue()
                };
                Log.Verbose(nameof(InitializationOptions) + " {@InitializationOptions}", initializationOptions);

                return initializationOptions;
            }
        }

        public IEnumerable<string> FilesToWatch => null;

        public object MiddleLayer => null;

        public object CustomMessageTarget { get; }

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            await Task.Yield();

            Connection connection = null;

            var process = _languageServerProcess.Create(_settingsService.TraceLevel);

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
            _rpc.JsonSerializer.ContractResolver = new CustomCamelCasePropertyNamesContractResolver(new HashSet<Type> { typeof(TelemetryProperties)});
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

        public static async Task TriggerLspInitializeAsync()
        {
            string path = null;

            try
            {
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                if (!(Package.GetGlobalService(typeof(DTE)) is DTE2 dte)) return;

                path = Path.Combine(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), "Resources", "codestream.codestream");

                var window = dte.OpenFile(Constants.vsViewKindCode, path);
                window.Visible = true;
                window.Close(vsSaveChanges.vsSaveChangesNo);
                Log.Verbose($"{nameof(TriggerLspInitializeAsync)} success for {path}");
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(TriggerLspInitializeAsync)} failed for {path}");
            }
        }
    }
}
