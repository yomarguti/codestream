namespace CodeStream.VisualStudio.Models
{
    public class WebviewReadyNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/view-ready";
        public override string Method => MethodName;
    }

    public class DidChangeActiveStreamNotification
    {
        public string StreamId { get; set; }
    }
    public class DidChangeActiveStreamNotificationType : NotificationType<DidChangeActiveStreamNotification>
    {
        public const string MethodName = "extension/changed-active-stream";
        public override string Method => MethodName;
    }

    public class DidOpenThreadNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/thread-opened";
        public override string Method => MethodName;
    }

    public class DidCloseThreadNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/thread-closed";
        public override string Method => MethodName;
    }

    public class DidChangeContextStateNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/context-state-changed";
        public override string Method => MethodName;
    }
}
