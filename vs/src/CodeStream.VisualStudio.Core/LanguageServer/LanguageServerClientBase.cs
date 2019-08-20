using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;
using System;
using CodeStream.VisualStudio.Core.Controllers;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Extensions;

namespace CodeStream.VisualStudio.Core.LanguageServer {
	public abstract class LanguageServerClientBase {
		private readonly ILogger Log;
		protected readonly IEventAggregator EventAggregator;
		protected readonly IServiceProvider ServiceProvider;
		protected readonly ISettingsServiceFactory SettingsServiceFactory;
		protected readonly ILanguageServerClientProcess LanguageServerProcess;

		protected LanguageServerClientBase(
			IServiceProvider serviceProvider,
			IEventAggregator eventAggregator,
			IBrowserServiceFactory browserServiceFactory,
			ISettingsServiceFactory settingsServiceFactory,
			ILogger logger) {
			Log = logger;
			try {
				ServiceProvider = serviceProvider;
				EventAggregator = eventAggregator;
				SettingsServiceFactory = settingsServiceFactory;
				var browserService = browserServiceFactory.Create();

				LanguageServerProcess = new LanguageServerClientProcess();
				CustomMessageTargetBase = new CustomMessageHandler(serviceProvider, EventAggregator, browserService, SettingsServiceFactory);

				Log.Ctor();
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(LanguageServerClientBase));
			}
		}

		public object CustomMessageTargetBase { get; }

		private object _initializationOptionsBase;
		public object InitializationOptionsBase {
			get {
				if (_initializationOptionsBase == null) {
					var settingsManager = SettingsServiceFactory.Create();
					if (settingsManager == null) {
						Log.Fatal($"{nameof(settingsManager)} is null");
					}
					var initializationOptions = new InitializationOptions {
						ServerUrl = settingsManager.ServerUrl,
						Extension = settingsManager.GetExtensionInfo(),
						Ide = settingsManager.GetIdeInfo(),
#if DEBUG
						TraceLevel = TraceLevel.Verbose.ToJsonValue(),
						IsDebugging = true,
#else
                        TraceLevel = settingsManager.GetAgentTraceLevel().ToJsonValue(),
#endif
						Proxy = settingsManager.Proxy,
						ProxySupport = settingsManager.ProxySupport.ToJsonValue()
					};
					if (Log.IsDebugEnabled()) {
						Log.Debug(nameof(InitializationOptions) + " {@InitializationOptions}", initializationOptions);
					}
					else {
						Log.Information(nameof(InitializationOptions) + " {@InitializationOptions}", new {
							TraceLevel = initializationOptions.TraceLevel,
							Proxy = initializationOptions.Proxy != null
						});
					}
					_initializationOptionsBase = initializationOptions;
				}

				return _initializationOptionsBase;
			}
		}

		protected async System.Threading.Tasks.Task OnServerInitializedBaseAsync(
			ICodeStreamAgentService codeStreamAgentService, IComponentModel componentModel) {
			try {
				Log.Debug($"{nameof(OnServerInitializedBaseAsync)} starting...");
				var sessionService = componentModel.GetService<ISessionService>();
				sessionService.SetState(AgentState.Ready);

				Log.Debug($"TryAutoSignInAsync starting...");
				var authenticationController = new AuthenticationController(
					SettingsServiceFactory.Create(),
					sessionService,
					codeStreamAgentService,
					EventAggregator,
					componentModel.GetService<ICredentialsService>(),
					componentModel.GetService<IWebviewUserSettingsService>()
					);
				var autoSignInResult = await authenticationController.TryAutoSignInAsync();
				Log.Information($"AutoSignIn Result={autoSignInResult}");
				EventAggregator.Publish(new LanguageServerReadyEvent { IsReady = true });
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(OnServerInitializedBaseAsync));
				throw;
			}
		}
	}
}
