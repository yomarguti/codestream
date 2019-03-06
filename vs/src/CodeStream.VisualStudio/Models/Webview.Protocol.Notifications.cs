namespace CodeStream.VisualStudio.Models
{
    public class WebviewDidInitializeNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/didInitialize";
        public override string Method => MethodName;
    }

    public class WebviewDidChangeActiveStreamNotification
    {
        public string StreamId { get; set; }
    }

    public class WebviewDidChangeActiveStreamNotificationType : NotificationType<WebviewDidChangeActiveStreamNotification>
    {
        public const string MethodName = "host/stream/didChangeActive";
        public override string Method => MethodName;
    }

    public class WebviewDidChangeContextNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/context/didChange";
        public override string Method => MethodName;
    }

    public class WebviewDidOpenThreadNotification
    {
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
    }

    public class WebviewDidOpenThreadNotificationType : NotificationType<WebviewDidOpenThreadNotification>
    {
        public const string MethodName = "host/thread/didOpen";
        public override string Method => MethodName;
    }

    public class WebviewDidCloseThreadNotification
    {
        public string ThreadId { get; set; }
    }

    public class WebviewDidCloseThreadNotificationType : NotificationType<WebviewDidCloseThreadNotification>
    {
        public const string MethodName = "host/thread/didClose";
        public override string Method => MethodName;
    }
}
