using Microsoft.VisualStudio.LanguageServer.Protocol;
using System;

namespace CodeStream.VisualStudio.Models
{
    public interface IHightlight
    {
        string Uri { get; }
        Range Range { get; }
        bool Highlight { get; }
    }

    public class EditorHighlightRangeRequest : IHightlight
    {
        public EditorHighlightRangeRequest(Uri uri, Range range, bool highlight)
        {
            Uri = uri.ToString();
            Range = range;
            Highlight = highlight;
        }

        public string Uri { get; }
        /// <summary>
        /// A single-line range with start & end char of 0 indicates a full-line highlight
        /// </summary>
        public Range Range { get; }
        public bool Highlight { get; }
    }

    public class EditorHighlightRangeRequestType : RequestType<EditorHighlightRangeRequest>
    {
        public const string MethodName = "host/editor/range/highlight";
        public override string Method => MethodName;
    }

    public class EditorRevealRangeRequest
    {
        public EditorRevealRangeRequest(Uri uri, Range range, bool? preserveFocus)
        {
            Uri = uri.ToString();
            Range = range;
            PreserveFocus = preserveFocus;
        }

        public string Uri { get; }
        public Range Range { get; }
        public bool? PreserveFocus { get; }
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

    public class EditorSelectRangeRequest : IHightlight
    {
        public EditorSelectRangeRequest(Uri uri, Range range, bool highlight)
        {
            Uri = uri.ToString();
            Range = range;
            Highlight = highlight;
        }

        public string Uri { get; }
        /// <summary>
        /// A single-line range with start & end char of 0 indicates a full-line highlight
        /// </summary>
        public Range Range { get; }
        public bool Highlight { get; }
    }

    public class EditorSelectRangeRequestType : RequestType<EditorSelectRangeRequest>
    {
        public const string MethodName = "host/editor/range/select";
        public override string Method => MethodName;
    }
}
