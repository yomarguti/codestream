using Microsoft.VisualStudio.LanguageServer.Protocol;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Models
{
    public class HostDidChangeActiveEditorNotificationEditor
    {
        public HostDidChangeActiveEditorNotificationEditor(string fileName, Uri uri, List<EditorSelection> selections, List<Range> visibleRanges, int? lineCount)
        {
            FileName = fileName;
            Uri = uri.ToString();
            Selections = selections;
            VisibleRanges = visibleRanges;
            LineCount = lineCount;
        }

        public string FileName { get; }
        public string Uri { get; }
        public List<EditorSelection> Selections { get; }
        public List<Range> VisibleRanges { get; }
        public int? LineCount { get;  }

        public string LanguageId { get; set; }
        public EditorMetrics Metrics { get; set; }
    }

    public class HostDidChangeActiveEditorNotification
    {
        public HostDidChangeActiveEditorNotificationEditor Editor { get; set; }
    }

    public class HostDidChangeActiveEditorNotificationType : NotificationType<HostDidChangeActiveEditorNotification>
    {
        public const string MethodName = "webview/editor/didChangeActive";
        public override string Method => MethodName;
    }

    public class HostDidChangeConfigNotification
    {
        public bool? MuteAll { get; set; }
        public bool? ShowFeedbackSmiley { get; set; }
        public bool? ShowHeadshots { get; set; }
        public bool? ViewCodemarksInline { get; set; }
        public bool? ShowMarkerCodeLens { get; set; }
        public bool? ShowMarkerGlyphs { get; set; }
    }

    public class HostDidChangeConfigNotificationType : NotificationType<HostDidChangeConfigNotification>
    {
        public const string MethodName = "webview/config/didChange";
        public override string Method => MethodName;
    }

    public class HostDidChangeEditorSelectionNotification
    {
        public HostDidChangeEditorSelectionNotification(Uri uri, List<EditorSelection> selections, List<Range> visibleRanges, int? lineCount)
        {
            Uri = uri.ToString();
            Selections = selections;
            VisibleRanges = visibleRanges;
            LineCount = lineCount;
        }

        public string Uri { get; }
        public List<EditorSelection> Selections { get; }
        public List<Range> VisibleRanges { get; }
        public int? LineCount { get; }
    }

    public class HostDidChangeEditorSelectionNotificationType : NotificationType<HostDidChangeEditorSelectionNotification>
    {
        public const string MethodName = "webview/editor/didChangeSelection";
        public override string Method => MethodName;
    }

    public class HostDidChangeEditorVisibleRangesNotification
    {
        public HostDidChangeEditorVisibleRangesNotification(Uri uri, List<EditorSelection> selections, List<Range> visibleRanges, int? lineCount)
        {
            Uri = uri.ToString();
            Selections = selections;
            VisibleRanges = visibleRanges;
            LineCount = lineCount;
        }

        public string Uri { get; }
        public List<EditorSelection> Selections { get; }
        public List<Range> VisibleRanges { get; }
        public int? LineCount { get;  }
    }

    public class HostDidChangeEditorVisibleRangesNotificationType : NotificationType<HostDidChangeEditorVisibleRangesNotification>
    {
        public const string MethodName = "webview/editor/didChangeVisibleRanges";
        public override string Method => MethodName;
    }

    public class HostDidChangeFocusNotification
    {
        /// <summary>
        /// Is the IDE focused?
        /// </summary>
        public bool Focused { get; set; }
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
