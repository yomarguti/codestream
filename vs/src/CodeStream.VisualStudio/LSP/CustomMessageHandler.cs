using System;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using Newtonsoft.Json.Linq;
using StreamJsonRpc;
// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP
{
    public class DidChangeDocumentMarkersNotification
    {
        public TextDocumentIdentifier TextDocument { get; set; }
    }

    internal class CustomMessageHandler
    {
        private readonly IEventAggregator _eventAggregator;
        public CustomMessageHandler(IEventAggregator eventAggregator)
        {
            _eventAggregator = eventAggregator;
        }

        [JsonRpcMethod("codeStream/didChangeData")]
        public void OnDidChangeData(JToken e)
        {
          //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codeStream/didChangeConnectionStatus")]
        public void OnDidChangeConnectionStatus(JToken e)
        {
          //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codeStream/didChangeDocumentMarkers")]
        public void OnDidChangeDocumentMarkers(JToken e)
        {
            var message = e.ToObject<DidChangeDocumentMarkersNotification>();
          //  System.Diagnostics.Debugger.Break();
            _eventAggregator.Publish(new DocumentMarkerChangedEvent
            {
                Uri = message.TextDocument.Uri
            });
        }

        [JsonRpcMethod("codeStream/didChangeVersionCompatibility")]
        public void OnDidChangeVersionCompatibility(JToken e)
        {
          //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codeStream/didLogout")]
        public void OnDidLogout(JToken e)
        {
           // System.Diagnostics.Debugger.Break();
        }
    }
}