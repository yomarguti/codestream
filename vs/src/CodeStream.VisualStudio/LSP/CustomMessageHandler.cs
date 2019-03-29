using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP {
	internal class CustomMessageHandler {
		private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();

		private readonly IEventAggregator _eventAggregator;
		private readonly IWebviewIpc _ipc;
		private readonly DebounceDispatcher _documentMarkersDispatcher = new DebounceDispatcher();

		public CustomMessageHandler(IEventAggregator eventAggregator, IWebviewIpc ipc) {
			_eventAggregator = eventAggregator;
			_ipc = ipc;
		}

		[JsonRpcMethod(DidChangeDataNotificationType.MethodName)]
		public void OnDidChangeData(JToken e) {
			_ipc.Notify(new DidChangeDataNotificationType(e));
		}

		[JsonRpcMethod(DidChangeConnectionStatusNotificationType.MethodName)]
		public void OnDidChangeConnectionStatus(JToken e) {
			var @params = e.ToObject<DidChangeConnectionStatusNotification>();

			Log.Verbose($"{nameof(OnDidChangeConnectionStatus)} {@params.Status}");

			switch (@params.Status) {
				case ConnectionStatus.Disconnected: {
						// TODO: Handle this
						break;
					}
				case ConnectionStatus.Reconnecting:
					_ipc.Notify(new DidChangeConnectionStatusNotificationType(@params));
					break;
				case ConnectionStatus.Reconnected: {
						if (@params.Reset == true) {
							_ipc.BrowserService.ReloadWebView();
							return;
						}

						_ipc.Notify(new DidChangeConnectionStatusNotificationType(@params));
						break;
					}
				default: {
						break;
					}
			}
		}

		[JsonRpcMethod(DidChangeDocumentMarkersNotificationType.MethodName)]
		public void OnDidChangeDocumentMarkers(JToken e) {
			_documentMarkersDispatcher.Debounce(100, o => {
				var @params = e.ToObject<DidChangeDocumentMarkersNotification>();

				if (@params == null) {
					Log.Warning($"{nameof(@params)} is null");
					return;
				}

				Log.Verbose($"{nameof(OnDidChangeDocumentMarkers)} {@params?.TextDocument?.Uri}");

				var uriString = @params.TextDocument.Uri;
				_ipc.Notify(new DidChangeDocumentMarkersNotificationType {
					Params = new DidChangeDocumentMarkersNotification {
						TextDocument = new TextDocumentIdentifier {
							Uri = uriString
						}
					}
				});

				_eventAggregator.Publish(new DocumentMarkerChangedEvent {
					Uri = uriString.ToUri()
				});
			});
		}

		[JsonRpcMethod(DidChangeVersionCompatibilityNotificationType.MethodName)]
		public void OnDidChangeVersionCompatibility(JToken e) {
			Log.Verbose($"{nameof(OnDidChangeVersionCompatibility)}");

			_ipc.Notify(new DidChangeVersionCompatibilityNotificationType(e));
		}

		[JsonRpcMethod(DidLogoutNotificationType.MethodName)]
		public void OnDidLogout(JToken e) {
			var @params = e.ToObject<DidLogoutNotification>();

			Log.Verbose($"{nameof(OnDidLogout)} {@params.Reason}");

			_eventAggregator.Publish(new AuthenticationChangedEvent { Reason = @params.Reason });

			_ipc.Notify(new DidLogoutNotificationType {
				Params = @params
			});
		}
	}
}
