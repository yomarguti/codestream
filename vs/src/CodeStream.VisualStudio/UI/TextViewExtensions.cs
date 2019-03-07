using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.Linq;
using Range = Microsoft.VisualStudio.LanguageServer.Protocol.Range;

namespace CodeStream.VisualStudio.UI
{
    public static class TextViewExtensions
    {
        public static void TryRemoveProperty(this IWpfTextView textView, string key)
        {
            textView.TextBuffer.Properties.TryRemoveProperty(key);
        }

        public static void TryRemoveProperty(this PropertyCollection collection, string key)
        {
            if (!collection.ContainsProperty(key)) return;

            collection.RemoveProperty(key);
        }

        public static bool TryDisposeProperty(this PropertyCollection collection, string key, bool removeProperty = true)
        {
            if (!collection.ContainsProperty(key)) return false;

            collection.GetProperty<List<IDisposable>>(key).Dispose();
            if (removeProperty)
            {
                collection.RemoveProperty(key);
            }

            return true;
        }    
       
        public static List<Range> ToRanges(this IWpfTextViewLineCollection lines)
        {
            return lines.Select(line => new Range { Start = new Position(line.Start.GetContainingLine().LineNumber, 0), End = new Position(line.End.GetContainingLine().LineNumber, 0) }).ToList();
        }                

        public static List<Range> ToVisibleRanges(this IWpfTextView textView) => textView.TextViewLines.ToRanges().Collapsed();
    }
}
