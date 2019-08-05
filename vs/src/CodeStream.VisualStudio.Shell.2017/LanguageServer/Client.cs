using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.LanguageServer;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Newtonsoft.Json;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Shell._2017.LanguageServer {

	public class LanguageServerClient2017 { }
	/// <summary>
	/// NOTE: See ContentDefinitions.cs for the LanguageClient partial class attributes
	/// </summary>
	[Export(typeof(ILanguageClient))]
	[Guid(Guids.LanguageClientId)]
	public partial class Client : LanguageServerClientBase, ILanguageClient, ILanguageClientCustomMessage, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<LanguageServerClient2017>();
		private bool _disposed;
		private JsonRpc _rpc;

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

		[ImportingConstructor]
		public Client(
			[Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider,
			IEventAggregator eventAggregator,
			IBrowserServiceFactory browserServiceFactory,
			ISettingsServiceFactory settingsServiceFactory)
			: base(serviceProvider, eventAggregator, browserServiceFactory, settingsServiceFactory, Log) {
			Instance = this;
		}

		public IEnumerable<string> FilesToWatch => null;

		public object MiddleLayer => null;

		public object CustomMessageTarget {
			get {
				return base.CustomMessageTargetBase;
			}
		}

		public static Client Instance { get; private set; }		

		public string Name => Application.Name;

		public IEnumerable<string> ConfigurationSections => null;

		public object InitializationOptions {
			get {
				return base.InitializationOptionsBase;
			}
		}

		public async System.Threading.Tasks.Task OnLoadedAsync() {
			using (Log.CriticalOperation($"{nameof(OnLoadedAsync)}")) {
				// ReSharper disable once PossibleNullReferenceException
				await StartAsync?.InvokeAsync(this, EventArgs.Empty);
			}
		}

		public async Task<Connection> ActivateAsync(CancellationToken token) {
			await System.Threading.Tasks.Task.Yield();
			Connection connection = null;
			try {
				var settingsManager = SettingsServiceFactory.Create();
				var process = LanguageServerProcess.Create(settingsManager?.TraceLevel);

				using (Log.CriticalOperation($"Starting language server process. FileName={process.StartInfo.FileName} Arguments={process.StartInfo.Arguments}", Serilog.Events.LogEventLevel.Information)) {
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

		public async System.Threading.Tasks.Task OnServerInitializedAsync() {
			try {
				using (Log.CriticalOperation($"{nameof(OnServerInitializedAsync)}")) {
					var componentModel = ServiceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
					Assumes.Present(componentModel);

					var codeStreamAgentService = componentModel.GetService<ICodeStreamAgentService>();
					await codeStreamAgentService.SetRpcAsync(_rpc);

					await base.OnServerInitializedBaseAsync(codeStreamAgentService, componentModel);
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
