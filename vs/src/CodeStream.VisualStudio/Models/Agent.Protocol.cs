using CodeStream.VisualStudio.Extensions;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Models
{

    //TODO bootstrapRequestType

    public class DidChangeDataNotificationTypeParams { }
    public class DidChangeDataNotificationType : NotificationType<DidChangeDataNotificationTypeParams>
    {
        public const string MethodName = "codestream/didChangeData";

        private readonly JToken _token;

        public DidChangeDataNotificationType(JToken token)
        {
            _token = token;
        }

        public override string Method => MethodName;

        public override string AsJson()
        {
            return @"{""method"":""" + Method + @""",""params"":" + _token.ToJson() + "}";
        }
    }

    public class DidChangeConnectionStatusNotification
    {
        public bool? Reset { get; set; }
        public ConnectionStatus Status { get; set; }
    }

    public class DidChangeConnectionStatusNotificationType : NotificationType<DidChangeConnectionStatusNotification>
    {
        public DidChangeConnectionStatusNotificationType() { }

        public DidChangeConnectionStatusNotificationType(DidChangeConnectionStatusNotification @params)
        {
            Params = @params;
        }

        public static string MethodName = "codestream/didChangeConnectionStatus";
        public override string Method => MethodName;
    }
}
