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

    public class TextDocumentChangedEvent : IEvent { }
}
