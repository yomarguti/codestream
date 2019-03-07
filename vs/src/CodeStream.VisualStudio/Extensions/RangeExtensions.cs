using Microsoft.VisualStudio.LanguageServer.Protocol;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Extensions
{
    public static class RangeExtensions
    {
        /// <summary>
        /// Collapses a list of ranges into the most compact set of ranges possible
        /// </summary> 
        /// <param name="ranges"></param>
        /// <returns></returns>
        internal static List<Range> Collapsed(this List<Range> ranges)
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

        public static List<Range> ToVisibleRanges(this List<Range> ranges) => ranges.Collapsed();
    }
}
