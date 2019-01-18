using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.LiveShare;
using System;
using System.Collections.Generic;
using CodeStream.VisualStudio.Annotations;

namespace CodeStream.VisualStudio.Events
{
    public class EventBase  { }

    public sealed class LanguageServerReadyEvent : EventBase
    {
        public bool IsReady { get; set; }
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

    public sealed class TextSelectionChangedEvent : EventBase { }

    public sealed class CodemarkVisibilityEvent : EventBase
    {
        public bool IsVisible { get; set; }
    }

    public sealed class CodeStreamConfigurationChangedEvent : EventBase
    {
        public bool OpenCommentOnSelect { get; set; }
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

    public abstract class DataChangedEventBase : EventBase
    {
        public abstract string Type { get; }
    }

    public sealed class CodemarksChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Codemarks;

        public List<CsFullCodemark> Data { get; set; }
    }

    public sealed class MarkerLocationsChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.MarkerLocations;

        public List<CsMarkerLocations> Data { get; set; }
    }

    public sealed class MarkersChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Markers;

        public List<CsMarker> Data { get; set; }
    }

    public sealed class PostsChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Posts;
        public List<CsPost> Data { get; set; }
    }

    [RequiresCustomization("has a custom message structure")]
    public sealed class PreferencesChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Preferences;
        public CsMePreferences Data { get; set; }
    }

    public sealed class RepositoriesChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Repositories;
        public List<CsRepository> Data { get; set; }
    }

    public sealed class StreamsChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Streams;
        public List<CsStream> Data { get; set; }
    }

    public sealed class TeamsChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Teams;
        public List<CsTeam> Data { get; set; }
    }

    [RequiresCustomization("has a custom message structure")]
    public sealed class UnreadsChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Unreads;
        public CsUnreads Data { get; set; }
    }

    public sealed class UsersChangedChangedEvent : DataChangedEventBase
    {
        public override string Type { get; } = ChangeDataType.Users;
        public List<CsUser> Data { get; set; }
    }

}
