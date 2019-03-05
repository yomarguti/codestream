using System;
using Microsoft.VisualStudio.LanguageServer.Protocol;

namespace CodeStream.VisualStudio.Models
{
    public class EditorHighlightRangeRequest  
    {
        public string Uri { get; set; }
        /// <summary>
        /// A single-line range with start & end char of 0 indicates a full-line highlight
        /// </summary>
        public Range Range { get; set; }
        public bool Highlight { get; set; }
        public string Source { get; set; }
    }

    public class EditorHighlightRangeRequestType : RequestType<EditorHighlightRangeRequest>
    {
        public const string MethodName = "host/editor/highlight/range";
        public override string Method => MethodName;
    }

    
    [Obsolete("use EditorHighlightRangeRequestType")]
    public class EditorHighlightLineRequest
    {
        public string Uri { get; set; }
        public int Line { get; set; }
        public bool Highlight { get; set; }
        public string Source { get; set; }
    }

    public class EditorHighlightLineResponse
    {
        public string Result { get; set; }
    }

    [Obsolete("use EditorHighlightRangeRequestType")]
    public class EditorHighlightLineRequestType : RequestType<EditorHighlightLineRequest>
    {
        public const string MethodName = "host/editor/highlight/line";
        public override string Method => MethodName;
    }

    [Obsolete("use EditorHighlightRangeRequest")]
    public class EditorHighlightMarkerRequest
    {
        public string Uri { get; set; }
        public int Line { get; set; }
        public bool Highlight { get; set; }
        public string Source { get; set; }
    }

    [Obsolete("use EditorHighlightRangeRequestType")]
    public class EditorHighlightMarkerRequestType : RequestType<EditorHighlightMarkerRequest>
    {
        public const string MethodName = "host/editor/highlight/marker";
        public override string Method => MethodName;
    }

    public class EditorRevealLineRequest
    {
        public int Number { get; set; }
    }
    public class EditorRevealLineResponse { }
    public class EditorRevealLineRequestType : RequestType<EditorRevealLineRequest>
    {
        public const string MethodName = "host/editor/reveal/line";
        public override string Method => MethodName;
    }

    public class EditorRevealMarkerRequest
    {
        public CsMarker Marker { get; set; }
        public bool PreserveFocus { get; set; }
    }

    public class EditorRevealMarkerResponse
    {
        public string Result { get; set; }
    }

    public class EditorRevealMarkerRequestType : RequestType<EditorRevealMarkerRequest>
    {
        public const string MethodName = "host/editor/reveal/marker";
        public override string Method => MethodName;
    }
}
