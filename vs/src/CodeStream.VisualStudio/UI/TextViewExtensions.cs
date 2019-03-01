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

        /// <summary>
        /// Collapses a list of ranges into the most compact set of ranges possible
        /// </summary> 
        /// <param name="ranges"></param>
        /// <returns></returns>
        public static List<Range> Collapsed(this List<Range> ranges)
        {
            if (!ranges.AnySafe()) return new List<Range>();

            var results = new List<Range>();
            var bufferStart = -1;
            var previousEnd = 0;

            foreach (var range in ranges)
            {
                if (bufferStart == -1 && range.Start.Line == range.End.Line)
                {
                    bufferStart = range.Start.Line;
                }
                else if (range.Start.Line != range.End.Line)
                {
                    if (bufferStart != -1)
                    {
                        results.Add(new Range
                        {
                            Start = new Position(bufferStart, 0),
                            End = new Position(previousEnd, 0)
                        });
                        bufferStart = -1;
                    }
                    results.Add(new Range
                    {
                        Start = new Position(range.Start.Line, 0),
                        End = new Position(range.End.Line, 0)
                    });
                }

                previousEnd = range.End.Line;
            }

            if (bufferStart != -1)
            {
                results.Add(new Range
                {
                    Start = new Position(bufferStart, 0),
                    End = new Position(previousEnd, 0)
                });
            }

            return results;
        }

        public static List<Range> ToRanges(this IWpfTextViewLineCollection lines)
        {
            return lines.Select(line => new Range { Start = new Position(line.Start.GetContainingLine().LineNumber, 0), End = new Position(line.End.GetContainingLine().LineNumber, 0) }).ToList();
        }
    }
}
