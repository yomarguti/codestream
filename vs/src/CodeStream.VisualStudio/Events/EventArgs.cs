namespace CodeStream.VisualStudio.Events
{
    public class LanguageServerReadyEvent : IEvent
    {
        public bool IsReady { get; set; }
    }

    public class SessionReadyEvent : IEvent
    {
        public bool IsReady { get; set; }
    }

    public class SessionLogoutEvent : IEvent { }

    public enum TextDocumentChangedReason
    {
        Unknown,
        Scrolled,
        Edited,
        ViewportHeightChanged
    }

    public class TextDocumentChangedEvent : IEvent
    {
        public TextDocumentChangedReason Reason { get; set; }
    }

    public class CodeMarkChangedEvent : IEvent
    {
        public string Uri { get; set; }
    }
}
