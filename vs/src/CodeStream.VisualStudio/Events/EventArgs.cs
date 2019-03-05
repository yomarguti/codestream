using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.LiveShare;
using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Events
{
	public class EventBase { }

	public sealed class LanguageServerReadyEvent : EventBase
	{
		public bool IsReady { get; set; }
	}

	public sealed class LanguageServerDisconnectedEvent : EventBase
	{
		public string Message { get; }
		public string Description { get; }
		public string Reason { get; }
		public Exception Exception { get; }

		public LanguageServerDisconnectedEvent(string message, string description, string reason, Exception exception)
		{
			Message = message;
			Description = description;
			Reason = reason;
			Exception = exception;
		}
	}

	public sealed class SessionReadyEvent : EventBase { }

	public sealed class SessionLogoutEvent : EventBase { }

	public enum TextDocumentChangedReason
	{
		Unknown,
		Scrolled,
		Edited,
		ViewportHeightChanged
	}

	public sealed class TextDocumentChangedEvent : EventBase
	{
		public TextDocumentChangedReason Reason { get; set; }
	}

	public sealed class ConnectionStatusChangedEvent : EventBase
	{
		public bool? Reset { get; set; }

		public ConnectionStatus Status { get; set; }
	}

	public sealed class AuthenticationChangedEvent : EventBase
	{
		public LogoutReason Reason { get; set; }
	}

	public sealed class CodemarkVisibilityEvent : EventBase
	{
		public bool IsVisible { get; set; }
	}

	public sealed class LiveShareStartedEvent : EventBase
	{
		public CollaborationSession CollaborationSession { get; }
		public LiveShareStartedEvent(CollaborationSession collaborationSession)
		{
			CollaborationSession = collaborationSession;
		}
	}

	public sealed class DocumentMarkerChangedEvent : EventBase
	{
		public Uri Uri { get; set; }
	}
}
