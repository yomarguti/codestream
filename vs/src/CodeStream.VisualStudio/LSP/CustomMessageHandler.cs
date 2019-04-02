using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
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

		private readonly IEventAggregator _eventAggregator;
		private readonly IWebviewIpc _ipc;
		private readonly Subject<DocumentMarkerChangedSubjectArgs> _documentMarkerChangedSubject;
		private readonly IDisposable _documentMarkerChangedSubscription;
	
		public CustomMessageHandler(IEventAggregator eventAggregator, IWebviewIpc ipc) {
			_eventAggregator = eventAggregator;
			_ipc = ipc;
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
			_ipc.Notify(new DidChangeDataNotificationType(e));
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

			if (@params == null) {
				Log.Warning($"{nameof(@params)} is null");
				return;
			}

			//this is too loud...
			//Log.Verbose($"{nameof(OnDidChangeDocumentMarkers)} {@params?.TextDocument?.Uri}");

			var uriString = @params.TextDocument.Uri;
			_ipc.NotifyAsync(new DidChangeDocumentMarkersNotificationType {
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

			_ipc.Notify(new DidChangeVersionCompatibilityNotificationType(e));
		}

		[JsonRpcMethod(DidLogoutNotificationType.MethodName)]
		public void OnDidLogout(JToken e) {
			var @params = e.ToObject<DidLogoutNotification>();

			Log.Information($"{nameof(OnDidLogout)} {@params.Reason}");

			_eventAggregator.Publish(new AuthenticationChangedEvent { Reason = @params.Reason });

			_ipc.Notify(new DidLogoutNotificationType {
				Params = @params
			});
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
