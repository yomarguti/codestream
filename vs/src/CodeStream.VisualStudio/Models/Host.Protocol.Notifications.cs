using Microsoft.VisualStudio.LanguageServer.Protocol;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Models
{
    public class HostDidChangeActiveEditorNotificationEditor
    {
        public string FileName { get; set; }
        public string FileStreamId { get; set; }
        public string LanguageId { get; set; }
        public string Uri { get; set; }
        public List<Range> VisibleRanges { get; set; }
    }

    public class HostDidChangeActiveEditorNotification
    {
        public HostDidChangeActiveEditorNotificationEditor Editor { get; set; }
    }

    public class HostDidChangeActiveEditorNotificationType : NotificationType<HostDidSelectCodeNotification>
    {
        public const string MethodName = "webview/editor/didChangeActive";
        public override string Method => MethodName;
    }

    public class HostDidChangeConfigNotification { }

    public class HostDidChangeConfigNotificationType : NotificationType<HostDidChangeConfigNotification>
    {
        public const string MethodName = "webview/config/didChange";
        public override string Method => MethodName;
    }

    public class HostDidChangeEditorSelectionNotification
    {
        public string Uri { get; set; }
        public List<EditorSelection> Selections { get; set; }
    }

    public class HostDidChangeEditorSelectionNotificationType : NotificationType<HostDidChangeEditorSelectionNotification>
    {
        public const string MethodName = "webview/editor/didChangeSelection";
        public override string Method => MethodName;
    }

    public class HostDidSelectCodeNotification
    {
        public string Code { get; set; }
        public string File { get; set; }
        public string FileUri { get; set; }
        public Range Range { get; set; }
        public Source Source { get; set; }
        public string GitError { get; set; }
        public bool? IsHighlight { get; set; }
        public string Type { get; set; }
    }

    public class HostDidSelectCodeNotificationType : NotificationType<HostDidSelectCodeNotification>
    {
        public const string MethodName = "webview/editor/didSelectCode";
        public override string Method => MethodName;
    }

    public class HostDidChangeEditorVisibleRangesNotification
    {
        public string Uri { get; set; }
        public List<Range> VisibleRanges { get; set; }
    }

    public class HostDidChangeEditorVisibleRangesNotificationType : NotificationType<HostDidChangeEditorVisibleRangesNotification>
    {
        public const string MethodName = "webview/editor/didChangeVisibleRanges";
        public override string Method => MethodName;
    }

    public class HostDidChangeFocusNotification
    {
    }

    public class HostDidChangeFocusNotificationType : NotificationType<HostDidChangeFocusNotification>
    {
        public const string MethodName = "webview/focus/didChange";
        public override string Method => MethodName;
    }

    public class HostDidLogoutNotification { }
    public class HostDidLogoutNotificationType : NotificationType<HostDidLogoutNotification>
    {
        public const string MethodName = "webview/didLogout";
        public override string Method => MethodName;
    }
}
