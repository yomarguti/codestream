using System;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;

// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP
{
    internal class CustomMessageHandler
    {
        private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();

        private readonly IEventAggregator _eventAggregator;
        private readonly IWebviewIpc _ipc;

        public CustomMessageHandler(IEventAggregator eventAggregator, IWebviewIpc ipc)
        {
            _eventAggregator = eventAggregator;
            _ipc = ipc;
        }

        [JsonRpcMethod("codestream/didChangeData")]
        public void OnDidChangeData(JToken e)
        {
            _ipc.Notify(new DidChangeDataNotificationType(e));
        }

        [JsonRpcMethod("codestream/didChangeConnectionStatus")]
        public void OnDidChangeConnectionStatus(JToken e)
        {
            var @params = e.ToObject<DidChangeConnectionStatusNotification>();

            switch (@params.Status)
            {
                case ConnectionStatus.Disconnected:
                    // TODO: Handle this
                    break;
                case ConnectionStatus.Reconnecting:
                    _ipc.Notify(new DidChangeConnectionStatusNotificationType(@params));
                    break;
                case ConnectionStatus.Reconnected:
                {
                    if (@params.Reset == true)
                    {
                        _ipc.BrowserService.ReloadWebView();
                        return;
                    }

                    _ipc.Notify(new DidChangeConnectionStatusNotificationType(@params));
                    break;
                }
                default:
                {
                    break;
                }
            }
        }

        [JsonRpcMethod("codestream/didChangeDocumentMarkers")]
        public void OnDidChangeDocumentMarkers(JToken e)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                var message = e.ToObject<DocumentMarkersNotification>();
                _eventAggregator.Publish(new DocumentMarkerChangedEvent { Uri = message.TextDocument.Uri.ToUri() });
            });
        }

        [JsonRpcMethod("codestream/didChangeVersionCompatibility")]
        public void OnDidChangeVersionCompatibility(JToken e)
        {
            // TODO implement this
            //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codestream/didLogout")]
        public void OnDidLogout(JToken e)
        {
            var message = e.ToObject<AuthenticationNotification>();
            _eventAggregator.Publish(new AuthenticationChangedEvent { Reason = message.Reason });
            _ipc.Notify(new HostDidLogoutNotificationType());
        }
    }
}