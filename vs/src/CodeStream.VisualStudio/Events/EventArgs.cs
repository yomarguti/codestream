using System;

namespace CodeStream.VisualStudio.Events
{
    public class LanguageServerReadyEvent : EventArgs, IEvent
    {
        public bool IsReady { get; set; }
    }

    public class SessionReadyEvent : EventArgs, IEvent
    {
        public bool IsReady { get; set; }
    }

    public class SessionLogoutEvent : EventArgs, IEvent { }

    public enum TextDocumentChangedReason
    {
        Unknown,
        Scrolled,
        Edited,
        ViewportHeightChanged
    }

    public class TextDocumentChangedEvent : EventArgs, IEvent
    {
        public TextDocumentChangedReason Reason { get; set; }
    }

    public class TextSelectionChangedEvent : EventArgs, IEvent
    {
        
    }

    public class CodemarkChangedEvent : EventArgs, IEvent
    {
        public string Uri { get; set; }
    }

    public class CodemarkVisibilityEvent : EventArgs, IEvent
    {
        public bool IsVisible { get; set; }
    }

    public class CodeStreamConfigurationChangedEvent : EventArgs, IEvent
    {
         public bool OpenCommentOnSelect { get; set; }
    }
}
