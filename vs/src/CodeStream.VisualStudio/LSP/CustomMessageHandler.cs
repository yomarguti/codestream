using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using CodeStream.VisualStudio.Extensions;

// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP
{
	internal class CustomMessageHandler
	{
		private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();

		private readonly IEventAggregator _eventAggregator;
		public CustomMessageHandler(IEventAggregator eventAggregator)
		{
			_eventAggregator = eventAggregator;
		}

		[JsonRpcMethod("codeStream/didChangeData")]
		public void OnDidChangeData(JToken e)
		{
			_eventAggregator.Publish(new DataChangedEvent(e));
		}

		[JsonRpcMethod("codeStream/didChangeConnectionStatus")]
		public void OnDidChangeConnectionStatus(JToken e)
		{
			var message = e.ToObject<ConnectionStatusNotification>();
			_eventAggregator.Publish(new ConnectionStatusChangedEvent
			{
				Reset = message.Reset,
				Status = message.Status
			});
		}

		[JsonRpcMethod("codeStream/didChangeDocumentMarkers")]
		public void OnDidChangeDocumentMarkers(JToken e)
		{
			ThreadHelper.JoinableTaskFactory.Run(async delegate
			{
				await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

				var message = e.ToObject<DocumentMarkersNotification>();
				_eventAggregator.Publish(new DocumentMarkerChangedEvent { Uri = message.TextDocument.Uri.ToUri() });
			});
		}

		[JsonRpcMethod("codeStream/didChangeVersionCompatibility")]
		public void OnDidChangeVersionCompatibility(JToken e)
		{
			// TODO implement this
			//  System.Diagnostics.Debugger.Break();
		}

		[JsonRpcMethod("codeStream/didLogout")]
		public void OnDidLogout(JToken e)
		{
			var message = e.ToObject<AuthenticationNotification>();
			_eventAggregator.Publish(new AuthenticationChangedEvent { Reason = message.Reason });
		}
	}
}