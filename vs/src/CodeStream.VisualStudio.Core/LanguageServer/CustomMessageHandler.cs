using CodeStream.VisualStudio.Core.Controllers;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Packages;
using CodeStream.VisualStudio.Core.Services;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Reactive.Linq;
using System.Reactive.Subjects;

// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.Core.LanguageServer {
	public class CustomMessageHandler : IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();
		
		private readonly IServiceProvider _serviceProvider;
		private readonly IEventAggregator _eventAggregator;
		private readonly IBrowserService _browserService;
		private readonly ISettingsServiceFactory _settingsServiceFactory;

		private readonly Subject<DocumentMarkerChangedSubjectArgs> _documentMarkerChangedSubject;
		private readonly IDisposable _documentMarkerChangedSubscription;

		public CustomMessageHandler(
			IServiceProvider serviceProvider,
			IEventAggregator eventAggregator,
			IBrowserService browserService,
			ISettingsServiceFactory settingsServiceFactory) {			
			_serviceProvider = serviceProvider;
			_eventAggregator = eventAggregator;
			_browserService = browserService;
			_settingsServiceFactory = settingsServiceFactory;

			_documentMarkerChangedSubject = new Subject<DocumentMarkerChangedSubjectArgs>();

			_documentMarkerChangedSubscription = _documentMarkerChangedSubject
				.Throttle(TimeSpan.FromMilliseconds(500))
				.Subscribe(e => {
					_eventAggregator.Publish(new DocumentMarkerChangedEvent {
						Uri = e.Uri.ToUri()
					});
				});
		}

		[JsonRpcMethod(DidChangeDataNotificationType.MethodName)]
		public void OnDidChangeData(JToken e) {
			_browserService.EnqueueNotification(new DidChangeDataNotificationType(e));
		}

		[JsonRpcMethod(DidChangeConnectionStatusNotificationType.MethodName)]
		public void OnDidChangeConnectionStatus(JToken e) {
			var @params = e.ToObject<DidChangeConnectionStatusNotification>();
			Log.Information($"{nameof(OnDidChangeConnectionStatus)} {@params.Status}");

			switch (@params.Status) {
				case ConnectionStatus.Disconnected: {
						// TODO: Handle this
						break;
					}
				case ConnectionStatus.Reconnecting:
					_browserService.EnqueueNotification(new DidChangeConnectionStatusNotificationType(@params));
					break;
				case ConnectionStatus.Reconnected: {
						if (@params.Reset == true) {
							_browserService.ReloadWebView();
							return;
						}

						_browserService.EnqueueNotification(new DidChangeConnectionStatusNotificationType(@params));
						break;
					}
				default: {
						break;
					}
			}
		}

		[JsonRpcMethod(DidChangeApiVersionCompatibilityNotificationType.MethodName)]
		public void OnDidChangeApiVersionCompatibilityNotification(JToken e) {
			using (Log.CriticalOperation($"{nameof(OnDidChangeApiVersionCompatibilityNotification)} Method={DidChangeApiVersionCompatibilityNotificationType.MethodName}", Serilog.Events.LogEventLevel.Information)) {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					try {
						var toolWindowProvider = _serviceProvider.GetService(typeof(SToolWindowProvider)) as IToolWindowProvider;
						Assumes.Present(toolWindowProvider);
						if (!toolWindowProvider.IsVisible(Guids.WebViewToolWindowGuid)) {
							toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);
						}
					}
					catch (Exception ex) {
						Log.Error(ex, nameof(OnDidChangeApiVersionCompatibilityNotification));
					}
				});

				_browserService.EnqueueNotification(new DidChangeApiVersionCompatibilityNotificationType(e));
			}
		}

		public class DocumentMarkerChangedSubjectArgs {
			public DocumentMarkerChangedSubjectArgs(string uri) {
				Uri = uri;
			}
			public string Uri { get; private set; }
			public JToken Token { get; set; }
		}

		[JsonRpcMethod(DidChangeDocumentMarkersNotificationType.MethodName)]
		public void OnDidChangeDocumentMarkers(JToken e) {
			var @params = e.ToObject<DidChangeDocumentMarkersNotification>();
			if (@params == null) return;

			//this is too loud...
			//Log.Verbose($"{nameof(OnDidChangeDocumentMarkers)} {@params?.TextDocument?.Uri}");

			var uriString = @params.TextDocument.Uri;
			_browserService.EnqueueNotification(new DidChangeDocumentMarkersNotificationType {
				Params = new DidChangeDocumentMarkersNotification {
					TextDocument = new TextDocumentIdentifier {
						Uri = uriString
					}
				}
			});

			if (@params.Reason == ChangeReason.Codemarks) {
				//allow the response to the webview to happen immediately, but do not send
				//this event always -- it will try to re-render margins, which can be cpu heavy
				_documentMarkerChangedSubject.OnNext(new DocumentMarkerChangedSubjectArgs(uriString));
			}
		}

		[JsonRpcMethod(DidChangeVersionCompatibilityNotificationType.MethodName)]
		public void OnDidChangeVersionCompatibility(JToken e) {
			using (Log.CriticalOperation($"{nameof(OnDidChangeVersionCompatibility)} Method={DidChangeVersionCompatibilityNotificationType.MethodName}", Serilog.Events.LogEventLevel.Information)) {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
					try {
						var toolWindowProvider = _serviceProvider.GetService(typeof(SToolWindowProvider)) as IToolWindowProvider;
						Assumes.Present(toolWindowProvider);
						if (!toolWindowProvider.IsVisible(Guids.WebViewToolWindowGuid)) {
							toolWindowProvider?.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);
						}
					}
					catch (Exception ex) {
						Log.Error(ex, nameof(OnDidChangeVersionCompatibility));
					}
				});

				_browserService.EnqueueNotification(new DidChangeVersionCompatibilityNotificationType(e));
			}
		}

		[JsonRpcMethod(DidLogoutNotificationType.MethodName)]
		public async System.Threading.Tasks.Task OnDidLogout(JToken e) {
			try {
				var @params = e.ToObject<DidLogoutNotification>();
				using (Log.CriticalOperation($"{nameof(OnDidLogin)} Method={DidLogoutNotificationType.MethodName} Reason={@params?.Reason}", Serilog.Events.LogEventLevel.Information)) {
					if (@params.Reason == LogoutReason.Token) {
						try {
							await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
							var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
							Assumes.Present(componentModel);

							var authenticationServiceFactory = componentModel.GetService<IAuthenticationServiceFactory>();
							if (authenticationServiceFactory != null) {
								var authService = authenticationServiceFactory.Create();
								if (authService == null) {
									Log.Error(nameof(OnDidLogout) + " " + nameof(authService) + " is null");
									return;
								}
								await authService.LogoutAsync(SessionSignedOutReason.UserSignedOutFromWebview);
							}
						}
						catch (Exception ex) {
							Log.Error(ex, nameof(OnDidLogout));
						}
					}
					else {
						// TODO: Handle this
					}					
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnDidLogout));
			}
		}

		[JsonRpcMethod(DidLoginNotificationType.MethodName)]
		public void OnDidLogin(JToken e) {
			using (Log.CriticalOperation($"{nameof(OnDidLogin)} Method={DidLoginNotificationType.MethodName}", Serilog.Events.LogEventLevel.Debug)) {
				try {
					if (e == null) {
						Log.IsNull(nameof(OnDidLogin));
					}
					else {
						var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
						Assumes.Present(componentModel);

						var authenticationController = new AuthenticationController(
							_settingsServiceFactory.Create(),
							componentModel.GetService<ISessionService>(),
							_eventAggregator,
							componentModel.GetService<ICredentialsService>(),
							componentModel.GetService<IWebviewUserSettingsService>()
							);

						authenticationController.CompleteSigninAsync(e["data"]);
					}
				}
				catch (Exception ex) {
					Log.Error(ex, "Problem with AutoSignIn");
				}
			}
		}

		//[JsonRpcMethod(DidStartLoginNotificationType.MethodName)]
		//public void OnDidStartLogin() {
		//	using (Log.CriticalOperation($"{nameof(OnDidStartLogin)} Method={DidStartLoginNotificationType.MethodName}", Serilog.Events.LogEventLevel.Debug)) {
		//		try {
		//			var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
		//			Assumes.Present(componentModel);

		//			componentModel.GetService<ISessionService>().SetState(SessionState.UserSigningIn);

		//			_eventAggregator.Publish(new SessionDidStartSignInEvent());
		//		}
		//		catch (Exception ex) {
		//			Log.Error(ex, nameof(OnDidStartLogin));
		//		}
		//	}
		//}

		//[JsonRpcMethod(DidFailLoginNotificationType.MethodName)]
		//public void OnFailLogin() {
		//	using (Log.CriticalOperation($"{nameof(OnFailLogin)} Method={DidFailLoginNotificationType.MethodName}", Serilog.Events.LogEventLevel.Debug)) {
		//		try {
		//			_eventAggregator.Publish(new SessionDidFailSignInEvent());
		//		}
		//		catch (Exception ex) {
		//			Log.Error(ex, nameof(OnFailLogin));
		//		}
		//	}
		//}

		private bool _disposed = false;

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed) return;

			if (disposing) {
				_documentMarkerChangedSubscription?.Dispose();
			}

			_disposed = true;
		}
	}
}
