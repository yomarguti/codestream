using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Classification;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using CodeStream.VisualStudio.Core.Logging;
using Serilog;

namespace CodeStream.VisualStudio.UI.Margins
{
    internal class VerticalScrollbarMarker : FrameworkElement, ICodeStreamWpfTextViewMargin
    {
        private static readonly ILogger Log = LogManager.ForContext<VerticalScrollbarMarker>();

        private double MarkPadding = 3.0;
        private double MarkThickness = 2.0;
        private double MarkHeight = 6;

        private const int DefaultMarginWidth = 12;
        private static readonly object InitializeLock = new object();

        private readonly IWpfTextView _textView;
        private readonly ITextDocument _textDocument;
        private readonly IVerticalScrollBar _verticalScrollBar;
        private readonly IEditorFormatMap _editorFormatMap;
        private readonly ISessionService _sessionService;

        private bool _hasEvents;
        private bool _initialized;

        private bool _isDisposed;
        private bool _isMarginEnabled;

        private Brush _marginMatchBrush;
        private bool _optionsChanging;

        private BackgroundMarkerPlacement _search;

        public VerticalScrollbarMarker(
            IWpfTextViewHost wpfTextViewHost,
            ITextDocument textDocument,
            IVerticalScrollBar verticalScrollBar,
            IEditorFormatMapService editorFormatMapService,
            ISessionService sessionService)
        {
            if (wpfTextViewHost == null) throw new ArgumentNullException("wpfTextViewHost");

            _sessionService = sessionService;

            _textView = wpfTextViewHost.TextView;
            _textDocument = textDocument;
            _verticalScrollBar = verticalScrollBar;
            _editorFormatMap = editorFormatMapService.GetEditorFormatMap(_textView);

            IsHitTestVisible = false;
            Width = DefaultMarginWidth;

            _textView.Options.OptionChanged += OnOptionChanged;
            IsVisibleChanged += OnViewOrMarginVisibilityChanged;
            _textView.VisualElement.IsVisibleChanged += OnViewOrMarginVisibilityChanged;

            OnOptionChanged(null, null);

            TryInitialize();
        }

        public void TryInitialize()
        {
            if (IsReady())
            {
                OnSessionReady();
            }
            else
            {
                HideMargin();
            }
        }

        public FrameworkElement VisualElement
        {
            get
            {
                ThrowIfDisposed();
                return this;
            }
        }

        public double MarginSize
        {
            get
            {
                ThrowIfDisposed();
                return ActualWidth;
            }
        }

        public bool Enabled
        {
            get
            {
                ThrowIfDisposed();
                return _isMarginEnabled;
            }
        }

        public ITextViewMargin GetTextViewMargin(string marginName)
        {
            return string.Compare(marginName, PredefinedCodestreamNames.CodemarkTextViewScrollbarMargin,
                       StringComparison.OrdinalIgnoreCase) == 0
                ? this
                : null;
        }

        /// <summary>
        ///     Handler for layout changed events.
        /// </summary>
        public void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            if (AnyTextChanges(e.OldViewState.EditSnapshot.Version, e.NewViewState.EditSnapshot.Version))
            {
                //There were text changes so we need to recompute possible matches
                UpdateMatches();
            }
        }

        public void OnSessionReady()
        {
            if (_initialized) return;

            lock (InitializeLock)
            {
                if (!_initialized)
                {
                    ShowMargin();
                    _initialized = true;
                }
            }
        }

        public bool IsReady() => _sessionService.IsReady;

        public void OnSessionLogout()
        {
            _initialized = false;
            HideMargin();
        }

        public void OnMarkerChanged()
        {
            UpdateMatches(true);
        }

        public void HideMargin() => Visibility = Visibility.Collapsed;

        public void ShowMargin() => Visibility = Visibility.Visible;

        public void ToggleMargin(bool isVisible)
        {
            if (isVisible)
            {
                ShowMargin();
            }
            else
            {
                HideMargin();
            }
        }

        public void RefreshMargin() => UpdateMatches();

        private void OnOptionChanged(object sender, EditorOptionChangedEventArgs e)
        {
            var wasMarginEnabled = _isMarginEnabled;
            _isMarginEnabled = _textView.Options.GetOptionValue(VerticalScrollbarMarkersEnabledOption.OptionKey);

            try
            {
                _optionsChanging = true;

                Visibility = Enabled ? Visibility.Visible : Visibility.Collapsed;
            }
            finally
            {
                _optionsChanging = false;
            }

            var refreshed = UpdateEventHandlers(true);

            //If the UpdateEventHandlers call above didn't initiate a search then we need to force the adornments and the margin to update
            //to update if they were turned on/off.
            if (!refreshed)
            {
                if (wasMarginEnabled != _isMarginEnabled)
                {
                    InvalidateVisual();
                }
            }
        }

        private void OnViewOrMarginVisibilityChanged(object sender, DependencyPropertyChangedEventArgs e)
        {
            //There is no need to update event handlers if the visibility change is the result of an options change (since we will
            //update the event handlers after changing all the options).
            //
            //It is possible this will get called twice in quick succession (when the tab containing the host is made visible, the view and the margin
            //will get visibility changed events).
            if (!_optionsChanging)
            {
                UpdateEventHandlers(true);
            }
        }

        private void OnFormatMappingChanged(object sender, FormatItemsEventArgs e)
        {
            _marginMatchBrush = GetBrush(VerticalScrollbarMarkerColorFormat.Name, EditorFormatDefinition.ForegroundBrushId);
        }

        private bool MarginActive => _isMarginEnabled && IsVisible;

        private bool UpdateEventHandlers(bool checkEvents)
        {
            var needEvents = checkEvents &&
                             _textView.VisualElement.IsVisible &&
                             MarginActive;

            if (needEvents != _hasEvents)
            {
                _hasEvents = needEvents;
                if (needEvents)
                {
                    _editorFormatMap.FormatMappingChanged += OnFormatMappingChanged;
                    _verticalScrollBar.Map.MappingChanged += OnMappingChanged;

                    OnFormatMappingChanged(null, null);

                    return UpdateMatches();
                }

                _editorFormatMap.FormatMappingChanged -= OnFormatMappingChanged;

                _verticalScrollBar.Map.MappingChanged -= OnMappingChanged;

                if (_search != null)
                {
                    _search.Abort();
                    _search = null;
                }
            }

            return false;
        }

        private Brush GetBrush(string name, string resource)
        {
            var rd = _editorFormatMap.GetProperties(name);

            if (rd.Contains(resource))
            {
                return rd[resource] as Brush;
            }

            return null;
        }

        /// <summary>
        ///     Handler for the scrollbar changing its coordinate mapping.
        /// </summary>
        private void OnMappingChanged(object sender, EventArgs e)
        {
            //Simply invalidate the visual: the positions of the various highlights haven't changed.
            InvalidateVisual();
        }

        private static bool AnyTextChanges(ITextVersion oldVersion, ITextVersion currentVersion)
        {
            while (oldVersion != currentVersion)
            {
                if (oldVersion.Changes.Count > 0) return true;

                oldVersion = oldVersion.Next;
            }

            return false;
        }

        /// <summary>
        ///     Start a background search
        /// </summary>
        /// <returns>
        ///     true if a either a search has been queued or if the adornments/margin have been cleared since the highlight was
        ///     removed.
        /// </returns>
        private bool UpdateMatches(bool force = false)
        {
            if (_hasEvents)
            {
                //Do a new search if the highlight changed, there is no existing search, or the existing search was on the wrong snapshot.
                if (_search == null || _search.Snapshot != _textView.TextSnapshot || force)
                {
                    //The text of the highlight changes ... restart the search.
                    if (_search != null)
                    {
                        //Stop and blow away the old search (even if it didn't finish, the results are not interesting anymore).
                        _search.Abort();
                        _search = null;
                    }

                    //The underlying buffer could be very large, meaning that doing the search for all matches on the UI thread
                    //is a bad idea. Do the search on the background thread and use a callback to invalidate the visual when
                    //the entire search has completed.
                    _search = new BackgroundMarkerPlacement(
                        _textView.TextSnapshot,
                        _textDocument,
                        delegate
                        {
                            //Force the invalidate to happen on the UI thread to satisfy WPF
                            Dispatcher.Invoke(DispatcherPriority.Normal,
                                new DispatcherOperationCallback(delegate
                                {
                                    //Guard against the view closing before dispatcher executes this.
                                    if (!_isDisposed)
                                    {
                                        InvalidateVisual();
                                    }

                                    return null;
                                }),
                                null);
                        });

                    return true;
                }
            }

            return false;
        }

        /// <summary>
        ///     Override for the FrameworkElement's OnRender. When called, redraw
        ///     all of the markers
        /// </summary>
        protected override void OnRender(DrawingContext drawingContext)
        {
            base.OnRender(drawingContext);

            if (_search == null || Visibility != Visibility.Visible) return;

            try
            {
                //Take a snapshot of the matches found to date (this could still be changing
                //if the search has not completed yet).
                var matches = _search.Matches;

                var lastY = double.MinValue;
                var markerCount = Math.Min(500, matches.Count);
                for (var i = 0; i < markerCount; ++i)
                {
                    //Get (for small lists) the index of every match or, for long lists, the index of every
                    //(count / 1000)th entry. Use longs to avoid any possible integer overflow problems.
                    var index = (int) (i * (long) matches.Count / markerCount);
                    var match = matches[index].Start;

                    //Translate the match from its snapshot to the view's current snapshot (the versions should be the same,
                    //but this will handle it if -- for some reason -- they are not).
                    var y = Math.Floor(
                        _verticalScrollBar.GetYCoordinateOfBufferPosition(match.TranslateTo(_textView.TextSnapshot,
                            PointTrackingMode.Negative)));
                    if (y + MarkThickness > lastY)
                    {
                        lastY = y;
                        var rectX = 6;
                        var rectY = y - MarkThickness * 0.75;
                        var rectWidth = Width - MarkPadding * 2.0;
                        var rectHeight = MarkHeight;

                        drawingContext.DrawRectangle(_marginMatchBrush, null,
                            new Rect(
                                x: rectX,
                                y: rectY,
                                width: rectWidth,
                                height: rectHeight)
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "drawingContext");
            }
        }

        private void ThrowIfDisposed()
        {
            if (_isDisposed)
                throw new ObjectDisposedException(PredefinedCodestreamNames.CodemarkTextViewScrollbarMargin);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_isDisposed) return;

            if (disposing)
            {
                _textView.Options.OptionChanged -= OnOptionChanged;
                IsVisibleChanged -= OnViewOrMarginVisibilityChanged;
                _textView.VisualElement.IsVisibleChanged -= OnViewOrMarginVisibilityChanged;

                UpdateEventHandlers(false);
            }

            _isDisposed = true;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        private class BackgroundMarkerPlacement
        {
            private static readonly List<SnapshotSpan> EmptyList = new List<SnapshotSpan>(0);
            public ITextSnapshot Snapshot { get; }
            private bool _abort;
            private List<DocumentMarker> _markers;

            /// <summary>
            /// Call <paramref name="completionCallback" /> once the search has completed.
            /// </summary>
            /// <param name="snapshot">Text snapshot in which to search.</param>
            /// <param name="textDocument"></param>
            /// <param name="completionCallback">Delegate to call if the search is completed (will be called on the UI thread).</param>
            /// <remarks>The constructor must be called from the UI thread.</remarks>
            public BackgroundMarkerPlacement(ITextSnapshot snapshot, ITextDocument textDocument, Action completionCallback)
            {
                Snapshot = snapshot;

                ThreadPool.QueueUserWorkItem(delegate
                {
                    //Lower our priority so that we do not compete with the rendering.
                    Thread.CurrentThread.Priority = ThreadPriority.Lowest;
                    Thread.CurrentThread.IsBackground = true;

                    var newMatches = new List<SnapshotSpan>();

                    if (textDocument.TextBuffer.Properties.ContainsProperty(PropertyNames.CodemarkMarkers))
                        _markers = textDocument.TextBuffer.Properties.GetProperty<List<DocumentMarker>>(PropertyNames
                            .CodemarkMarkers);

                    if (_markers == null) return;

                    foreach (var span in snapshot.Lines)
                    {
                        var lineNumber = span.Start.GetContainingLine().LineNumber;
                        var marker = _markers.FirstOrDefault(_ => _?.Range?.Start.Line == lineNumber);
                        if (marker == null) continue;

                        var start = span.Start == 0 ? span.Start : span.Start - 1;
                        newMatches.Add(new SnapshotSpan(start, 1));
                    }

                    //This should be a thread safe operation since it is atomic
                    Matches = newMatches;

                    completionCallback();
                });
            }

            public IList<SnapshotSpan> Matches { get; private set; } = EmptyList;

            public void Abort()
            {
                _abort = true;
            }
        }
    }
}