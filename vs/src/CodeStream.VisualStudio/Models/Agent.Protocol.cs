using System;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Models
{

    public class EditorMargins
    {
        public int? Top { get; set; }
        public int? Right { get; set; }
        public int? Bottom { get; set; }
        public int? Left { get; set; }
    }

    public class EditorMetrics
    {
        public int? FontSize { get; set; }
        public int? LineHeight { get; set; }
        public EditorMargins EditorMargins { get; set; }
    }

    public static class WebviewPanels
    {
        public static string Codemarks = "knowledge";
        public static string CodemarksForFile = "codemarks-for-file";
    }

	[Serializable]
    public class WebviewContext
    {
        public string CurrentTeamId { get; set; }
        public string CurrentStreamId { get; set; }
        public string ThreadId { get; set; }
        public bool HasFocus { get; set; }
        public List<string> PanelStack { get; set; }
    }

    public class EditorContext
    {
        public GetRangeScmInfoResponse Scm { get; set; }
        public string ActiveFile { get; set; }
        public string LastActiveFile { get; set; }
        public List<Range> TextEditorVisibleRanges { get; set; }
        public string TextEditorUri { get; set; }
        public List<EditorSelection> TextEditorSelections { get; set; }
        public EditorMetrics Metrics { get; set; }
        public int? TextEditorLineCount { get; set; }
    }

    public class UserSession
    {
        public string UserId { get; set; }
    }

    public class Services
    {
        public bool? Vsls { get; set; }
    }

    public class Capabilities
    {
        public bool? ChannelMute { get; set; }
        public bool? CodemarkApply { get; set; }
        public bool? CodemarkCompare { get; set; }
        public bool EditorTrackVisibleRange { get; set; }
        public Services Services { get; set; }
    }

    public class Configs
    {
        public Configs()
        {
#if DEBUG
            Debug = true;
#endif
        }

        public bool Debug { get; set; }
        public string ServerUrl { get; set; }
        public string Email { get; set; }
        public bool ShowAvatars { get; set; }
        public bool MuteAll { get; set; }
        public string Team { get; set; }
        public bool AutoHideMarkers { get; set; }
        //public bool ShowMarkerCodeLens { get; set; }
        public bool ShowMarkerGlyphs { get; set; }
        public bool ShowFeedbackSmiley { get; set; }
        public bool ViewCodemarksInline { get; set; }
    }

    public class BootstrapPartialRequest
    {

    }

    public class BootstrapPartialResponseAnonymous
    {
        public Capabilities Capabilities { get; set; }
        public Configs Configs { get; set; }
        public string Env { get; set; }
        public string Version { get; set; }
    }

    public class BootstrapAuthenticatedResponse : BootstrapPartialResponseAnonymous
    {
        public WebviewContext Context { get; set; }
        public EditorContext EditorContext { get; set; }
        public UserSession Session { get; set; }
    }

    public class BootstrapRequestType : RequestType<BootstrapAuthenticatedResponse>
    {
        public static string MethodName = "codestream/bootstrap";
        public override string Method => MethodName;
    }
}
