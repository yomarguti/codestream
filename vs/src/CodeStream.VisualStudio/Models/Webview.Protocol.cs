using System;
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
        public NewCodemarkNotification(Uri uri, Range range, CodemarkType type)
        {
            Uri = uri.ToString();
            Range = range;
            Type = type;
        }

        public string Uri { get; }
        public Range  Range { get; }
        public CodemarkType Type { get; }
    }

    public class NewCodemarkNotificationType : NotificationType<NewCodemarkNotification>
    {
        public const string MethodName = "webview/codemark/new";
        public override string Method => MethodName;
    }
}
