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
    }

    public class EditorHighlightRangeRequestType : RequestType<EditorHighlightRangeRequest>
    {
        public const string MethodName = "host/editor/range/highlight";
        public override string Method => MethodName;
    }

    public class EditorRevealRangeRequest
    {
        public string Uri { get; set; }
        public Range Range { get; set; }
        public bool? PreserveFocus { get; set; }
    }

    public class EditorRevealMarkerResponse
    {
        // NOTE: see EditorRevealRangeResult in ts
        public string Result { get; set; } 
    }

    public class EditorRevealRangeRequestType : RequestType<EditorRevealRangeRequest>
    {
        public const string MethodName = "host/editor/range/reveal";
        public override string Method => MethodName;
    }

    public class EditorSelectRangeRequest
    {
        public string Uri { get; set; }
        /// <summary>
        /// A single-line range with start & end char of 0 indicates a full-line highlight
        /// </summary>
        public Range Range { get; set; }
        public bool Highlight { get; set; }
    }

    public class EditorSelectRangeRequestType : RequestType<EditorSelectRangeRequest>
    {
        public const string MethodName = "host/editor/range/select";
        public override string Method => MethodName;
    }
}
