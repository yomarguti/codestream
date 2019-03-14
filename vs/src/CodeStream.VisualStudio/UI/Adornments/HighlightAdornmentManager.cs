using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;
using Serilog;
using System;
using System.Collections.Generic;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;

namespace CodeStream.VisualStudio.UI.Adornments
{
    public interface ICanHighlightRange
    {
        void Highlight(Range range, bool highlight);
    }

    public class HighlightAdornmentManager : ICanHighlightRange, IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<HighlightAdornmentManager>();

        private readonly IAdornmentLayer _highlightAdornmentLayer;
        private readonly IWpfTextView _textView;
        private readonly Dictionary<int, LineInfo> _lineInfos;

        public HighlightAdornmentManager(IWpfTextView textView)
        {
            _textView = textView;
            _lineInfos = new Dictionary<int, LineInfo>();
            _highlightAdornmentLayer = textView.GetAdornmentLayer(TextViewCreationListener.LayerName);

            textView.LayoutChanged += OnLayoutChanged;
            //textView.ViewportWidthChanged += OnViewportWidthChanged;
            textView.ViewportLeftChanged += OnViewportLeftChanged;
        }

        public void Highlight(Range range, bool highlight)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (!_lineInfos.AnySafe())
            {
                Populate(_textView, _textView.TextViewLines);
            }

            if (!highlight)
            {
                _highlightAdornmentLayer.RemoveAllAdornments();
                return;
            }

            try
            {
                var brush = CreateBrush();

                range = Normalize(range);
                var lineStart = range.Start.Line;
                var lineEnd = range.End.Line;

                for (var i = range.Start.Line; i <= range.End.Line; i++)
                {
                    if (!_lineInfos.TryGetValue(i, out LineInfo lineInfo))
                    {
                        // couldn't get its info
                        continue;
                    }

                    Placement placement;
                    if (lineStart == lineEnd)
                    {
                        //single line
                        var length = range.End.Character == int.MaxValue
                            ? lineInfo.Snapshot.End.Position - lineInfo.Snapshot.Start.Position
                            : range.End.Character - range.Start.Character;
                        if (length == 0)
                        {
                            //highlight whole line
                            placement = new Placement(_textView.ViewportLeft, _textView.ViewportWidth);
                        }
                        else
                        {
                            placement = _textView
                                .GetGeometryPlacement(new SnapshotSpan(lineInfo.Snapshot.Snapshot, new Span(lineInfo.Snapshot.Start + range.Start.Character, length)));
                        }
                    }
                    else
                    {
                        if (i == lineStart)
                        {
                            var startPosition = range.Start.Character + lineInfo.Snapshot.Start;
                            var endLength = lineInfo.Snapshot.End.Position - startPosition;
                            placement = _textView
                                .GetGeometryPlacement(new SnapshotSpan(lineInfo.Snapshot.Snapshot, new Span(startPosition, endLength)));
                        }
                        else if (i == lineEnd)
                        {
                            var endLength = range.End.Character == int.MaxValue
                                ? lineInfo.Snapshot.End.Position - lineInfo.Snapshot.Start.Position
                                : range.End.Character;
                            placement = _textView
                                .GetGeometryPlacement(new SnapshotSpan(lineInfo.Snapshot.Snapshot, new Span(lineInfo.Snapshot.Start, endLength)));
                        }
                        else
                        {
                            // some middle line
                            placement = _textView.GetGeometryPlacement(lineInfo.Snapshot);
                        }
                    }

                    var element = new Rectangle
                    {
                        Height = lineInfo.Height,
                        Width = placement.Width,
                        Fill = brush
                    };

                    Canvas.SetLeft(element, range.Start.Character == 0 ? (int)_textView.ViewportLeft : placement.Left);
                    Canvas.SetTop(element, lineInfo.Top);

                    _highlightAdornmentLayer.AddAdornment(lineInfo.Snapshot, null, element);
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, $"{range.ToString()}");
            }
        }

        private SolidColorBrush CreateBrush()
        {
            var themedColor = VSColorTheme.GetThemedColor(EnvironmentColors.ScrollBarBackgroundColorKey);
            var brush = new SolidColorBrush(Color.FromRgb(themedColor.R, themedColor.G, themedColor.B));
            if (brush.CanFreeze)
            {
                brush.Freeze();
            }

            return brush;
        }

        /// <summary>
        /// Changes a 1,0,2,0 to 1,0,1,int.Max where that equals startLine, startChar, endLine, endChar
        /// </summary>
        /// <param name="range"></param>
        /// <returns></returns>
        private static Range Normalize(Range range)
        {
            if (range.Start.Line == range.End.Line - 1 && range.End.Character == 0)
            {
                return new Range
                {
                    Start = new Position(range.Start.Line, range.Start.Character),
                    End = new Position(range.Start.Line, int.MaxValue)
                };
            }

            return new Range
            {
                Start = new Position(range.Start.Line, range.Start.Character),
                End = new Position(range.End.Line, range.End.Character)
            };
        }

        /// <summary>
        /// Populates (or refreshes) the cache that stores all the lineInfo data.
        /// It's stored in a dictionary for easy lookup later when highlighting
        /// based on start/end lines is required.
        /// </summary>
        /// <param name="textView"></param>
        /// <param name="textViewLines"></param>
        private void Populate(ITextView textView, IEnumerable<ITextViewLine> textViewLines)
        {
            foreach (var line in textViewLines)
            {
                // GetLineNumberFromPosition is 0-based
                var lineNumber = textView.TextSnapshot.GetLineNumberFromPosition(line.Extent.Start.Position);
                if (_lineInfos.ContainsKey(lineNumber))
                {
                    _lineInfos.Remove(lineNumber);
                }

                _lineInfos.Add(lineNumber, new LineInfo(line.Height, line.Top, line.Extent));
            }
        }

        private void OnViewportLeftChanged(object sender, EventArgs e)
        {
            var textView = sender as IWpfTextView;
            if (textView == null) return;

            foreach (var element in _highlightAdornmentLayer.Elements)
            {
                Canvas.SetLeft((Rectangle)element.Adornment, textView.ViewportLeft);
            }
        }

        //void OnViewportWidthChanged(object sender, EventArgs e)
        //{
        //    IWpfTextView textView = (IWpfTextView)sender;

        //    foreach (var r in this._highlightAdornmentLayer.Elements)
        //    {
        //        ((Rectangle)r.Adornment).Width = textView.ViewportWidth;
        //    }
        //}

        private void OnLayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            var textView = sender as IWpfTextView;
            if (textView == null) return;

            if (e.OldSnapshot != e.NewSnapshot && e.OldSnapshot.Version.Changes.IncludesLineChanges)
            {
                this._highlightAdornmentLayer.RemoveAllAdornments();
                Populate(textView, textView.TextViewLines);
            }
            else
            {
                Populate(textView, e.NewOrReformattedLines);
            }
        }

        private bool _disposed = false;

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed) return;

            if (disposing)
            {
                _textView.LayoutChanged += OnLayoutChanged;
                // _textView.ViewportWidthChanged += OnViewportWidthChanged;
                _textView.ViewportLeftChanged += OnViewportLeftChanged;
            }

            _disposed = true;
        }

        private class LineInfo
        {
            public LineInfo(double height, double top, SnapshotSpan snapshot)
            {
                Height = height;
                Top = top;
                Snapshot = snapshot;
            }

            public double Height { get; }
            public double Top { get; }
            public SnapshotSpan Snapshot { get; }
        }
    }
}
