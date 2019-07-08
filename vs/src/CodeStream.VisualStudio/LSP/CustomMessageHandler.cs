using CodeStream.VisualStudio.Controllers;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Reactive.Linq;
using System.Reactive.Subjects;

// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP {
	internal class CustomMessageHandler : IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();

		private readonly IServiceProvider _serviceProvider;
		private readonly IEventAggregator _eventAggregator;
		private readonly IBrowserService _browserService;
		private readonly ISettingsServiceFactory _settingsServiceFactory;

		private readonly Subject<DocumentMarkerChangedSubjectArgs> _documentMarkerChangedSubject;
		private readonly IDisposable _documentMarkerChangedSubscription;

		public CustomMessageHandler(IServiceProvider serviceProvider, IEventAggregator eventAggregator,
			IBrowserService browserService, ISettingsServiceFactory settingsServiceFactory) {
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
			Log.Information($"{nameof(OnDidChangeVersionCompatibility)}");
			_browserService.EnqueueNotification(new DidChangeVersionCompatibilityNotificationType(e));
		}

		[JsonRpcMethod(DidLogoutNotificationType.MethodName)]
		public void OnDidLogout(JToken e) {
			var @params = e.ToObject<DidLogoutNotification>();
			Log.Information($"{nameof(OnDidLogout)} {@params.Reason}");

			_browserService.Notify(new DidLogoutNotificationType {
				Params = @params
			});

			_eventAggregator.Publish(new AuthenticationChangedEvent { Reason = @params.Reason });
		}

		[JsonRpcMethod(DidLoginNotificationType.MethodName)]
		public void OnDidLogin(JToken e) {
			Log.Debug($"{nameof(OnDidLogin)}");
			if (e == null) {
				Log.Warning($"{nameof(OnDidLogin)} e is null");
				return;
			}
			try {
				var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
				Assumes.Present(componentModel);

				_ = new AuthenticationController(
					_settingsServiceFactory.Create(),
					componentModel.GetService<ISessionService>(),
					_eventAggregator,
					componentModel.GetService<ICredentialsService>()
					).CompleteSigninAsync(e["data"]);
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnDidLogin));
			}
		}

		[JsonRpcMethod(DidStartLoginNotificationType.MethodName)]
		public void OnDidStartLogin() {
			Log.Debug($"{nameof(OnDidStartLogin)}");
			try {
				var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
				Assumes.Present(componentModel);

				componentModel.GetService<ISessionService>().SetState(SessionState.UserSigningIn);

				_eventAggregator.Publish(new SessionDidStartSignInEvent());
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnDidStartLogin));
			}
		}

		[JsonRpcMethod(DidFailLoginNotificationType.MethodName)]
		public void OnFailLogin() {
			try {
				Log.Debug($"{nameof(OnFailLogin)}");
				_eventAggregator.Publish(new SessionDidFailSignInEvent());
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnFailLogin));
			}
		}

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
