using Microsoft.VisualStudio.LanguageServer.Protocol;

namespace CodeStream.VisualStudio.Models
{
    public class ShowCodemarkNotification
    {
        public string CodemarkId { get; set; }
        public bool? Simulated { get; set; }
    }

    // TODO -- not implemented yet
    public class ShowCodemarkNotificationType : NotificationType<ShowCodemarkNotification>
    {
        public const string MethodName = "webview/codemark/show";
        public override string Method => MethodName;
    }

    public class ShowStreamNotification
    {
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
    }

    public class ShowStreamNotificationType : NotificationType<ShowStreamNotification>
    {
        public const string MethodName = "webview/stream/show";
        public override string Method => MethodName;
    }

    public class NewCodemarkNotification
    {
        public string Uri { get; set; }
        public Range  Range { get; set; }
        public CodemarkType Type { get; set; }
    }

    public class NewCodemarkNotificationType : NotificationType<NewCodemarkNotification>
    {
        public const string MethodName = "webview/codemark/new";
        public override string Method => MethodName;
    }
}
