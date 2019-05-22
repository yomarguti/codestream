using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Threading;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft;
using Serilog;

namespace CodeStream.VisualStudio.LSP {
	public class LanguageClientDummy { }

	/// <summary>
	/// NOTE: See ContentDefinitions.cs for the LanguageClient partial class attributes
	/// </summary>
	[Export(typeof(ILanguageClient))]
	[Guid(Guids.LanguageClientId)]
	public partial class LanguageClient : ILanguageClient, ILanguageClientCustomMessage, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<LanguageClientDummy>();
		private bool _disposed = false;
		private readonly ILanguageServerProcess _languageServerProcess;

		public event AsyncEventHandler<EventArgs> StartAsync;
#pragma warning disable 0067
		public event AsyncEventHandler<EventArgs> StopAsync;
#pragma warning restore 0067

		//#if DEBUG
		//		/// <summary>
		//		/// This is how we can see a list of contentTypes (used to generate the attrs for this class)
		//		/// </summary>
		//		[Import]
		//		internal IContentTypeRegistryService ContentTypeRegistryService { get; set; }
		//#endif
		private readonly IEventAggregator _eventAggregator;
		private readonly IServiceProvider _serviceProvider;

		[ImportingConstructor]
		public LanguageClient(
			[Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider,
			IEventAggregator eventAggregator,
			IBrowserService ipc,
			ISettingsServiceFactory settingsServiceFactory) {
			Instance = this;
			try {
				_serviceProvider = serviceProvider;
				_eventAggregator = eventAggregator;
				_settingsManager = settingsServiceFactory.Create();

				_languageServerProcess = new LanguageServerProcess();
				CustomMessageTarget = new CustomMessageHandler(_eventAggregator, ipc);
				Log.Ctor();
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(LanguageClient));
			}
		}

		private readonly ISettingsManager _settingsManager;

		internal static LanguageClient Instance { get; private set; }
		private JsonRpc _rpc;

		public string Name => Application.Name;

		public IEnumerable<string> ConfigurationSections => null;

		public object InitializationOptions {
			get {
				var initializationOptions = new InitializationOptions {
					Extension = _settingsManager.GetExtensionInfo(),
					Ide = _settingsManager.GetIdeInfo(),
#if DEBUG
					TraceLevel = TraceLevel.Verbose.ToJsonValue(),
					IsDebugging = true,
#else
                    TraceLevel = _settingsManager.TraceLevel.ToJsonValue(),
#endif
					Proxy = _settingsManager.Proxy,
					ProxySupport = _settingsManager.ProxySupport.ToJsonValue()
				};
				Log.Debug(nameof(InitializationOptions) + " {@InitializationOptions}", initializationOptions);

				return initializationOptions;
			}
		}

		public IEnumerable<string> FilesToWatch => null;

		public object MiddleLayer => null;

		public object CustomMessageTarget { get; }

		public async Task<Connection> ActivateAsync(CancellationToken token) {
			await System.Threading.Tasks.Task.Yield();
			Connection connection = null;
			try {
				var process = _languageServerProcess.Create(_settingsManager?.TraceLevel);

				using (Log.CriticalOperation($"Starting server process. FileName={process.StartInfo.FileName} Arguments={process.StartInfo.Arguments}", Serilog.Events.LogEventLevel.Information)) {
					if (process.Start()) {
						connection = new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
					}
				}
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(ActivateAsync));
			}

			return connection;
		}

		public async System.Threading.Tasks.Task AttachForCustomMessageAsync(JsonRpc rpc) {
			await System.Threading.Tasks.Task.Yield();
			_rpc = rpc;

			// Slight hack to use camelCased properties when serializing requests
			_rpc.JsonSerializer.ContractResolver = new CustomCamelCasePropertyNamesContractResolver(new HashSet<Type> { typeof(TelemetryProperties) });
			_rpc.JsonSerializer.NullValueHandling = NullValueHandling.Ignore;
		}

		public async System.Threading.Tasks.Task OnLoadedAsync() {
			using (Log.CriticalOperation($"{nameof(OnLoadedAsync)}")) {
				// ReSharper disable once PossibleNullReferenceException
				await StartAsync?.InvokeAsync(this, EventArgs.Empty);
			}
		}

		public async System.Threading.Tasks.Task OnServerInitializedAsync() {
			try {
				using (Log.CriticalOperation($"{nameof(OnServerInitializedAsync)}")) {
					var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
					Assumes.Present(componentModel);

					var codeStreamAgentService = componentModel.GetService<ICodeStreamAgentService>();
					await codeStreamAgentService.SetRpcAsync(_rpc);
					var sessionService = componentModel.GetService<ISessionService>();
					sessionService.SetAgentReady();

					_eventAggregator.Publish(new LanguageServerReadyEvent { IsReady = true });
				}
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(OnServerInitializedAsync));
				throw;
			}
			await System.Threading.Tasks.Task.CompletedTask;
		}

		public System.Threading.Tasks.Task OnServerInitializeFailedAsync(Exception ex) {
			Log.Fatal(ex, nameof(OnServerInitializeFailedAsync));
			// must throw ex here, because we're not in a try/catch
			throw ex;
		}

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed) return;

			if (disposing) {
				var disposable = CustomMessageTarget as IDisposable;
				disposable?.Dispose();
			}

			_disposed = true;
		}
	}
}
