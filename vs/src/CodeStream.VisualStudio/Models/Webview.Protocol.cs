using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Models
{
    public class DidSelectStreamThreadNotificationTypeParams
    {
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
    }

    public class DidSelectStreamThreadNotificationType : NotificationType<DidSelectStreamThreadNotificationTypeParams>
    {
        public const string MethodName = "webview/stream-thread-selected";
        public override string Method => MethodName;
    }
}
