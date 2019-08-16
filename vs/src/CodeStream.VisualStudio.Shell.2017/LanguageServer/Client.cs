using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.LanguageServer;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.LanguageServer.Client;
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
		private ISolutionEventsListener _solutionEventListener;

		private bool _hasStartedOnce;
		private int _state;


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
			[Import(typeof(Microsoft.VisualStudio.Shell.SVsServiceProvider))] IServiceProvider serviceProvider,
			IEventAggregator eventAggregator,
			IBrowserServiceFactory browserServiceFactory,
			ISettingsServiceFactory settingsServiceFactory)
			: base(serviceProvider, eventAggregator, browserServiceFactory, settingsServiceFactory, Log) {
		}

		public string Name => Application.Name;
		public IEnumerable<string> ConfigurationSections => null;
		public object InitializationOptions {
			get {
				return base.InitializationOptionsBase;
			}
		}

		public IEnumerable<string> FilesToWatch => null;

		public object MiddleLayer => null;

		public object CustomMessageTarget {
			get {
				return base.CustomMessageTargetBase;
			}
		}

		public async Task<Connection> ActivateAsync(CancellationToken token) {
			await System.Threading.Tasks.Task.Yield();
			Connection connection = null;
			try {
				var settingsManager = SettingsServiceFactory.Create();
				var process = LanguageServerProcess.Create(settingsManager?.GetAgentTraceLevel());

				using (Log.CriticalOperation($"Started language server process. FileName={process.StartInfo.FileName} Arguments={process.StartInfo.Arguments}", Serilog.Events.LogEventLevel.Information)) {
					if (process.Start()) {
						connection = new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
					}
					else {
						Log.Warning("Could not start process");
					}
				}
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(ActivateAsync));
			}

			return connection;
		}

		public async System.Threading.Tasks.Task OnLoadedAsync() {
			try {
				using (Log.CriticalOperation($"{nameof(OnLoadedAsync)}")) {
					// ReSharper disable once PossibleNullReferenceException
					await StartAsync?.InvokeAsync(this, EventArgs.Empty);
					_hasStartedOnce = true;
					Interlocked.Exchange(ref _state, 1);

					if (_solutionEventListener == null) {
						var componentModel = ServiceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
						Assumes.Present(componentModel);

						_solutionEventListener = componentModel.GetService<ISolutionEventsListener>();
						_solutionEventListener.Closed += SolutionOrFolder_Closed;
						_solutionEventListener.Opened += SolutionOrFolder_Opened;
						Log.Verbose($"set {nameof(_solutionEventListener)}");
					}
				}
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(OnLoadedAsync));
			}
		}

		public async System.Threading.Tasks.Task AttachForCustomMessageAsync(JsonRpc rpc) {
			await System.Threading.Tasks.Task.Yield();
			_rpc = rpc;

			// Slight hack to use camelCased properties when serializing requests
			_rpc.JsonSerializer.ContractResolver = new CustomCamelCasePropertyNamesContractResolver(new HashSet<Type> { typeof(TelemetryProperties) });
			_rpc.JsonSerializer.NullValueHandling = NullValueHandling.Ignore;

			Log.Debug(nameof(AttachForCustomMessageAsync));
		}

		public async System.Threading.Tasks.Task OnServerInitializedAsync() {
			try {
				using (Log.CriticalOperation($"{nameof(OnServerInitializedAsync)}", Serilog.Events.LogEventLevel.Debug)) {
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
			if (_hasStartedOnce) {
				Log.Warning(ex, nameof(OnServerInitializeFailedAsync));
			}
			else {
				Log.Fatal(ex, nameof(OnServerInitializeFailedAsync));
			}

			return System.Threading.Tasks.Task.FromResult(0);
		}

		private readonly object locker = new object();
		ProjectType projectType;
		private void SolutionOrFolder_Opened(object sender, HostOpenedEventArgs e) {
			projectType = e.ProjectType;

			if (projectType == ProjectType.Folder) return;
			if (_state == 0) {
				lock (locker) {
					if (_state == 0) {
						try {
							using (Log.CriticalOperation($"{nameof(SolutionOrFolder_Opened)}")) {
								Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.RunAsync(async () => {
									try {
										// there's a bug in the MS LanguageServer code that creates
										// an object disposed exception on the rpc object when
										// a folder is opened after a solution (and the solutionClose triggered a StopAsync)
										// so for now, solution closing won't trigger a LanguageServer Client Stop, it will stop/start
										// when _another_ solution has opened
										await StopAsync?.InvokeAsync(this, EventArgs.Empty);
										await StartAsync?.InvokeAsync(this, EventArgs.Empty);
										Interlocked.Exchange(ref _state, 1);
										Log.Debug($"SetState={_state}");
									}
									catch (NullReferenceException ex) {
										Log.LocalWarning(ex?.Message);
									}
									catch (Exception ex) {
										Log.Error(ex, nameof(SolutionOrFolder_Opened));
									}
								});
							}
						}
						catch (Exception ex) {
							Log.Error(ex, nameof(SolutionOrFolder_Opened));
						}
					}
				}
			}
		}

		private void SolutionOrFolder_Closed(object sender, HostClosedEventArgs e) {
			try {
				if (projectType == ProjectType.Folder || e.ProjectType == ProjectType.Folder) return;

				if (_state == 1) {
					lock (locker) {
						if (_state == 1) {
							using (Log.CriticalOperation($"{nameof(SolutionOrFolder_Closed)}")) {
								// there's a bug in the MS LanguageServer code that creates
								// an object disposed exception on the rpc object when
								// a folder is opened after a solution (and the solutionClose triggered a StopAsync)
								Interlocked.Exchange(ref _state, 0);
								Log.Debug($"SetState={_state}");
							}
						}
					}
				}
			}
			finally {
				projectType = ProjectType.Unknown;
			}
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

				if (_solutionEventListener != null) {
					_solutionEventListener.Closed -= SolutionOrFolder_Closed;
					_solutionEventListener.Opened -= SolutionOrFolder_Opened;
				}
				_state = 0;
				_hasStartedOnce = false;
			}

			_disposed = true;
		}
	}
}
