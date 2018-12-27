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

    public class TextSelectionChangedEvent : IEvent
    {
        
    }

    public class CodemarkChangedEvent : IEvent
    {
        public string Uri { get; set; }
    }

    public class CodemarkVisibilityEvent : IEvent
    {
        public bool IsVisible { get; set; }
    }

    public class CodeStreamConfigurationChangedEvent : IEvent
    {
         public bool OpenCommentOnSelect { get; set; }
    }
}
