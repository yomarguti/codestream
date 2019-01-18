using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.LSP
{
    public class DocumentMarkersNotification
    {
        public TextDocumentIdentifier TextDocument { get; set; }
    }

    public abstract class DidChangeDataNotificationBase<T> where T : class, new()
    {
        public T Data { get; set; }
    }

    public class CodemarksChangedNotification : DidChangeDataNotificationBase<List<CsFullCodemark>>
    {

    }

    public class MarkerLocationsChangedNotification : DidChangeDataNotificationBase<List<CsMarkerLocations>>
    {

    }

    public class MarkersChangedNotification : DidChangeDataNotificationBase<List<CsMarker>>
    {

    }

    public class PostsChangedNotification : DidChangeDataNotificationBase<List<CsPost>>
    {

    }

    public class PreferencesChangedNotification : DidChangeDataNotificationBase<CsMePreferences>
    {

    }

    public class RepositoriesChangedNotification : DidChangeDataNotificationBase<List<CsRepository>>
    {

    }

    public class StreamsChangedNotification : DidChangeDataNotificationBase<List<CsStream>>
    {

    }

    public class TeamsChangedNotification : DidChangeDataNotificationBase<List<CsTeam>>
    {

    }

    public class UnreadsChangedNotification : DidChangeDataNotificationBase<CsUnreads>
    {

    }

    public class UsersChangedNotification : DidChangeDataNotificationBase<List<CsUser>>
    {

    }

    public class ConnectionStatusNotification
    {
        public bool? Reset { get; set; }

        public ConnectionStatus Status { get; set; }
    }

    public class AuthenticationNotification
    {
        public LogoutReason Reason { get; set; }
    }
}
