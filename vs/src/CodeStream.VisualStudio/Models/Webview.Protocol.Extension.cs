using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Models
{
    public class DidSelectCodeNotificationTypeParams
    {
        public string Code { get; set; }
        public string File { get; set; }
        public string FileUri { get; set; }
        public Range Range { get; set; }
        public Source Source { get; set; }
        public string GitError { get; set; }
        public bool? IsHighlight { get; set; }
    }

    public class DidHighlightCodeNotificationType : NotificationType<DidSelectCodeNotificationTypeParams>
    {
        public const string MethodName = "webview/code-highlighted";
        public override string Method => MethodName;
    }

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

    public class DidScrollEditorNotificationTypeParams { }
    public class DidScrollEditorNotificationType : NotificationType<DidScrollEditorNotificationTypeParams>
    {
        public const string MethodName = "webview/text-editor-scrolled";
        public override string Method => MethodName;
    }

    public class DidChangeDataNotificationTypeParams { }
    public class DidChangeDataNotificationType : NotificationType<DidChangeDataNotificationTypeParams>
    {
        public const string MethodName = "webview/data-changed";

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

    public class DidChangeConfigsNotificationTypeParams
    {
        public bool? MuteAll { get; set; }
        public bool? OpenCommentOnSelect { get; set; }
        public bool? ShowMarkers { get; set; }
    }

    public class DidChangeConfigsNotificationType : NotificationType<DidChangeConfigsNotificationTypeParams>
    {
        public const string MethodName = "webview/configs-changed";
        public override string Method => MethodName;
    }

    public class DidLoseConnectivityNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public static string MethodName = "webview/connectivity-lost";
        public override string Method => MethodName;
    }

    public class DidEstablishConnectivityNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public static string MethodName = "webview/connectivity-established";
        public override string Method => MethodName;
    }

    public class DidChangeActiveEditorNotificationTypeParamsEditor
    {
        public string FileStreamId { get; set; }
        //  public string Uri { get; set; }
        public string FileName { get; set; }
    }

    public class DidChangeActiveEditorNotificationParams
    {
        public DidChangeActiveEditorNotificationTypeParamsEditor Editor { get; set; }
    }

    public class DidChangeActiveEditorNotificationType : NotificationType<DidChangeActiveEditorNotificationParams>
    {
        public static string MethodName = "webview/active-editor-changed";
        public override string Method => MethodName;
    }

    public class DidFocusNotificationType : NotificationType<EmptyRequestTypeParams>
    {
        public static string MethodName = "webview/focused";
        public override string Method => MethodName;
    }
    public class DidBlurNotificationType : NotificationType<DidChangeActiveEditorNotificationParams>
    {
        public static string MethodName = "webview/blurred";
        public override string Method => MethodName;
    }
    public class DidSignOutNotificationType : NotificationType<DidChangeActiveEditorNotificationParams>
    {
        public static string MethodName = "webview/signed-out";
        public override string Method => MethodName;
    }
}
