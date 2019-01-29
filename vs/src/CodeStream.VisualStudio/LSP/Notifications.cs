using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.LSP
{
    public class DocumentMarkersNotification
    {
        public TextDocumentIdentifier TextDocument { get; set; }
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
