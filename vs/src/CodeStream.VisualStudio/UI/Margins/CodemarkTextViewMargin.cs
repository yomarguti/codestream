using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Glyphs;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Formatting;
using Microsoft.VisualStudio.Text.Tagging;
using Serilog;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Reactive.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace CodeStream.VisualStudio.UI.Margins
{
    /// <summary>
    /// Margin's canvas and visual definition including both size and content
    /// </summary>
    internal class CodemarkTextViewMargin : Canvas, IWpfTextViewMargin
    {
        /// <summary>
        /// A value indicating whether the object is disposed.
        /// </summary>
        private bool _isDisposed;

        private readonly IViewTagAggregatorFactoryService _viewTagAggregatorFactoryService;
        private readonly IEnumerable<Lazy<IGlyphFactoryProvider, IGlyphMetadata>> _glyphFactoryProviders;

        private readonly IWpfTextViewHost _wpfTextViewHost;
        private readonly IWpfTextView _textView;
        private readonly IEventAggregator _events;
        private readonly IToolWindowProvider _toolWindowProvider;
        private readonly ISessionService _sessionService;
        private readonly IEventAggregator _eventAggregator;
        private readonly ICodeStreamAgentService _agentService;
        private readonly List<IDisposable> _disposables;
        private bool _initializedCodestream;
        private readonly ITextDocument _textDocument;

        private readonly Dictionary<Type, GlyphFactoryInfo> _glyphFactories;
        private Canvas _iconCanvas;
        private Canvas[] _childCanvases;
        private Dictionary<object, LineInfo> _lineInfos;
        private ITagAggregator<IGlyphTag> _tagAggregator;

        private bool _openCommentOnSelect;
        private static readonly ILogger Log = LogManager.ForContext<CodemarkTextViewMargin>();
        private static int MARGIN_WIDTH = 20;
        DocumentMarkersResponse _markers = null;

        /// <summary>
        /// Initializes a new instance of the <see cref="CodemarkTextViewMargin"/> class for a given <paramref name="textView"/>.
        /// </summary>
        /// <param name="agentService"></param>
        /// <param name="settingsService"></param>
        /// <param name="textView">The <see cref="IWpfTextView"/> to attach the margin to.</param>
        /// <param name="glyphFactoryProviders"></param>
        /// <param name="wpfTextViewHost"></param>
        /// <param name="eventAggregator"></param>
        /// <param name="toolWindowProvider"></param>
        /// <param name="sessionService"></param>
        /// <param name="textDocumentFactoryService"></param>
        /// <param name="viewTagAggregatorFactoryService"></param>
        public CodemarkTextViewMargin(
            IViewTagAggregatorFactoryService viewTagAggregatorFactoryService,
            IEnumerable<Lazy<IGlyphFactoryProvider, IGlyphMetadata>> glyphFactoryProviders,
            IWpfTextViewHost wpfTextViewHost,
            IEventAggregator eventAggregator,
            IToolWindowProvider toolWindowProvider,
            ISessionService sessionService,
            ICodeStreamAgentService agentService,
            ISettingsService settingsService,
            IWpfTextView textView,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _viewTagAggregatorFactoryService = viewTagAggregatorFactoryService;
            _glyphFactoryProviders = glyphFactoryProviders;
            _wpfTextViewHost = wpfTextViewHost;
            _eventAggregator = eventAggregator;
            _toolWindowProvider = toolWindowProvider;
            _sessionService = sessionService;
            _agentService = agentService;
            _openCommentOnSelect = settingsService.OpenCommentOnSelect;
            _textView = textView;

            _glyphFactories = new Dictionary<Type, GlyphFactoryInfo>();
            _childCanvases = Array.Empty<Canvas>();

            if (!textDocumentFactoryService.TryGetTextDocument(_textView.TextBuffer, out _textDocument))
            {
#if DEBUG
                // why are we here?
                Debugger.Break();
#endif
            }

            Width = MARGIN_WIDTH;
            ClipToBounds = true;

            Background = new SolidColorBrush(Colors.Transparent);

            _events = new EventAggregator();

            //listening on the main thread since we have to change the UI state
            _disposables = new List<IDisposable>
            {
                eventAggregator.GetEvent<SessionReadyEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ =>
                    {
                        if (sessionService.IsReady && !_initializedCodestream)
                        {
                            InitializeCodestream();
                        }
                    }),
                eventAggregator.GetEvent<SessionLogoutEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ =>
                    {
                        Hide();
                        _initializedCodestream = false;
                    }),
                eventAggregator.GetEvent<CodemarkVisibilityEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ => { Toggle(_.IsVisible); })
            };

            if (sessionService.IsReady && !_initializedCodestream)
            {
                InitializeCodestream();
            }
            else
            {
                Hide();
            }
        }

        struct GlyphFactoryInfo
        {
            public int Order { get; }
            public IGlyphFactory Factory { get; }
            public IGlyphFactoryProvider FactoryProvider { get; }
            public Canvas Canvas { get; }

            public GlyphFactoryInfo(int order, IGlyphFactory factory, IGlyphFactoryProvider glyphFactoryProvider)
            {
                Order = order;
                Factory = factory ?? throw new ArgumentNullException(nameof(factory));
                FactoryProvider = glyphFactoryProvider ?? throw new ArgumentNullException(nameof(glyphFactoryProvider));
                Canvas = new Canvas { Background = Brushes.Transparent };
            }
        }

        struct LineInfo
        {
            public ITextViewLine Line { get; }
            public List<IconInfo> Icons { get; }

            public LineInfo(ITextViewLine textViewLine, List<IconInfo> icons)
            {
                Line = textViewLine ?? throw new ArgumentNullException(nameof(textViewLine));
                Icons = icons ?? throw new ArgumentNullException(nameof(icons));
            }
        }

        struct IconInfo
        {
            public UIElement Element { get; }
            public double BaseTopValue { get; }
            public int Order { get; }
            public IconInfo(int order, UIElement element)
            {
                Element = element ?? throw new ArgumentNullException(nameof(element));
                BaseTopValue = GetBaseTopValue(element);
                Order = order;
            }

            static double GetBaseTopValue(UIElement element)
            {
                double top = GetTop(element);
                return double.IsNaN(top) ? 0 : top;
            }
        }

        private List<IconInfo> CreateIconInfos(IWpfTextViewLine line)
        {
            var icons = new List<IconInfo>();

            foreach (var mappingSpan in _tagAggregator.GetTags(line.ExtentAsMappingSpan))
            {
                var tag = mappingSpan.Tag;
                if (tag == null)
                {
                    Log.Verbose($"Tag is null");
                    continue;
                }

                // Fails if someone forgot to Export(typeof(IGlyphFactoryProvider)) with the correct tag types
                var tagType = tag.GetType();
                bool b = _glyphFactories.TryGetValue(tag.GetType(), out GlyphFactoryInfo factoryInfo);
                if (!b)
                {
                    Log.Verbose($"Could not find glyph factory for {tagType}");
                    continue;
                }

                foreach (var span in mappingSpan.Span.GetSpans(_wpfTextViewHost.TextView.TextSnapshot))
                {
                    if (!line.IntersectsBufferSpan(span))
                        continue;

                    var elem = factoryInfo.Factory.GenerateGlyph(line, tag);
                    if (elem == null)
                        continue;

                    elem.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
                    var iconInfo = new IconInfo(factoryInfo.Order, elem);
                    icons.Add(iconInfo);

                    // ActualWidth isn't always valid when we're here so use the constant
                    SetLeft(elem, (MARGIN_WIDTH - elem.DesiredSize.Width) / 2);
                    SetTop(elem, iconInfo.BaseTopValue + line.TextTop);
                }
            }

            return icons;
        }

        void AddLine(Dictionary<object, LineInfo> newInfos, ITextViewLine line)
        {
            var wpfLine = line as IWpfTextViewLine;
            // Debug.Assert(wpfLine != null);
            if (wpfLine == null)
                return;

            var info = new LineInfo(line, CreateIconInfos(wpfLine));
            newInfos.Add(line.IdentityTag, info);
            foreach (var iconInfo in info.Icons)
            {
                _childCanvases[iconInfo.Order].Children.Add(iconInfo.Element);
            }
        }

        void OnNewLayout(IList<ITextViewLine> newOrReformattedLines, IList<ITextViewLine> translatedLines)
        {
            var newInfos = new Dictionary<object, LineInfo>();

            foreach (var line in newOrReformattedLines)
                AddLine(newInfos, line);

            foreach (var line in translatedLines)
            {
                bool b = _lineInfos.TryGetValue(line.IdentityTag, out LineInfo info);
                if (!b)
                {
#if DEBUG
                    // why are we here?
                    Debugger.Break();
#endif
                    continue;
                }

                _lineInfos.Remove(line.IdentityTag);
                newInfos.Add(line.IdentityTag, info);
                foreach (var iconInfo in info.Icons)
                    SetTop(iconInfo.Element, iconInfo.BaseTopValue + line.TextTop);
            }

            foreach (var line in _wpfTextViewHost.TextView.TextViewLines)
            {
                if (newInfos.ContainsKey(line.IdentityTag))
                    continue;

                if (!_lineInfos.TryGetValue(line.IdentityTag, out LineInfo info))
                    continue;

                _lineInfos.Remove(line.IdentityTag);
                newInfos.Add(line.IdentityTag, info);
            }

            foreach (var info in _lineInfos.Values)
            {
                foreach (var iconInfo in info.Icons)
                    _childCanvases[iconInfo.Order].Children.Remove(iconInfo.Element);
            }

            _lineInfos = newInfos;
        }

        private static readonly object InitializeLock = new object();

        private void InitializeCodestream()
        {
            lock (InitializeLock)
            {
                if (!_initializedCodestream)
                {
                    _disposables.Add(
                       _eventAggregator.GetEvent<DocumentMarkerChangedEvent>()
                      .ObserveOnDispatcher()
                      .Throttle(TimeSpan.FromMilliseconds(100))
                      .Subscribe(async (_) =>
                      {
                          Uri currentUri = null;
                          try
                          {
                              currentUri = _textDocument.FilePath.ToUri();
                              if (_.Uri.EqualsIgnoreCase(currentUri))
                              {
                                  Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} for {currentUri}");
                                  await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

                                  GetOrCreateMarkers(true);
                                  RefreshEverything();
                              }
                              else
                              {
                                  Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} ignored for {currentUri}");
                              }
                          }
                          catch (Exception ex)
                          {
                              Log.Warning(ex, $"{nameof(DocumentMarkerChangedEvent)} for {currentUri}");
                          }
                      }));

                    _disposables.Add(
                        _eventAggregator.GetEvent<CodeStreamConfigurationChangedEvent>()
                            .ObserveOnDispatcher()
                            .Throttle(TimeSpan.FromMilliseconds(100))
                            .Subscribe(_ => { _openCommentOnSelect = _.OpenCommentOnSelect; }));

                    _disposables.Add(_events.GetEvent<TextSelectionChangedEvent>()
                        .ObserveOnDispatcher()
                        .Throttle(TimeSpan.FromMilliseconds(500))
                        .Subscribe(_ =>
                        {
                            // TODO reconcile this!
                            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
                            var selectedText1 = ideService?.GetSelectedText();
                            if (selectedText1?.HasText == true)
                            {
                                var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
                                ThreadHelper.JoinableTaskFactory.Run(async delegate
                                {
                                    // ReSharper disable once PossibleNullReferenceException
                                    await codeStreamService.PostCodeAsync(new Uri(_textDocument.FilePath), selectedText1,
                                        true, _textDocument.IsDirty, CancellationToken.None);
                                });
                            }
                        }));

                    Show();

                    _textView.Selection.SelectionChanged += Selection_SelectionChanged;
                    _wpfTextViewHost.TextView.ZoomLevelChanged += TextView_ZoomLevelChanged;
                    _textView.LayoutChanged += TextView_LayoutChanged;

                    _initializedCodestream = true;

                    InitializeCore();

                    GetOrCreateMarkers(true);
                    RefreshEverything();
                }
            }
        }

        public static readonly DependencyProperty ZoomProperty =
            DependencyProperty.RegisterAttached("Zoom", typeof(double), typeof(Codemark),
                new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.Inherits));

        void TextView_ZoomLevelChanged(object sender, ZoomLevelChangedEventArgs e)
        {
            LayoutTransform = e.ZoomTransform;
            this.SetValue(ZoomProperty, e.NewZoomLevel / 100);
        }

        private void InitializeCore()
        {
            _iconCanvas = new Canvas { Background = Brushes.Transparent };

            this.Children.Add(_iconCanvas);
            _lineInfos = new Dictionary<object, LineInfo>();
            _tagAggregator = _viewTagAggregatorFactoryService.CreateTagAggregator<IGlyphTag>(_wpfTextViewHost.TextView);
            
            int order = 0;
            foreach (var lazy in _glyphFactoryProviders)
            {
                foreach (var type in lazy.Metadata.TagTypes)
                {
                    if (type == null)
                        break;

                    //Debug.Assert(!_glyphFactories.ContainsKey(type));
                    if (_glyphFactories.ContainsKey(type))
                        continue;

                    //Debug.Assert(typeof(IGlyphTag).IsAssignableFrom(type));
                    if (!typeof(IGlyphTag).IsAssignableFrom(type))
                        continue;

                    if (type == typeof(CodemarkGlyphTag))
                    {
                        var glyphFactory = lazy.Value.GetGlyphFactory(_wpfTextViewHost.TextView, this);

                        _glyphFactories.Add(type, new GlyphFactoryInfo(order++, glyphFactory, lazy.Value));
                    }
                }
            }

            _childCanvases = _glyphFactories.Values.OrderBy(a => a.Order).Select(a => a.Canvas).ToArray();
            _iconCanvas.Children.Clear();

            foreach (var c in _childCanvases)
                _iconCanvas.Children.Add(c);
        }

        void RefreshEverything()
        {
            _lineInfos.Clear();
            foreach (var c in _childCanvases)
                c.Children.Clear();

            OnNewLayout(_wpfTextViewHost.TextView.TextViewLines, Array.Empty<ITextViewLine>());
        }

        private void GetOrCreateMarkers(bool force = false)
        {
            if (_markers != null && _markers.Markers.AnySafe() == false && !force)
            {
                Log.Verbose("Codemarks are empty and force={force}", force);
                return;
            }

            var filePath = _textDocument.FilePath;
            if (!Uri.TryCreate(filePath, UriKind.Absolute, out Uri result))
            {
                Log.Verbose($"Could not parse file path as uri={filePath}");
                return;
            }

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                _markers = await _agentService.GetMarkersForDocumentAsync(result);

                if (_markers?.Markers.AnySafe() == true || force)
                {
                    if (_textView.TextBuffer.Properties.ContainsProperty(PropertyNames.CodemarkMarkers))
                    {
                        _textView.TextBuffer.Properties.RemoveProperty(PropertyNames.CodemarkMarkers);
                    }
                    _textView.TextBuffer.Properties.AddProperty(PropertyNames.CodemarkMarkers, _markers.Markers);
                    Log.Verbose("Setting Codemarks Count={Count}", _markers.Markers.Count);
                }
                else
                {
                    Log.Verbose("No Codemarks from agent");
                }
            });
        }

        private void TextView_LayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            if (!_sessionService.IsReady) return;

            if (Visibility == Visibility.Hidden || Width < 1) return;

            // get markers if it's null (first time) or we did something that isn't scrolling
            if (_markers == null || e.TranslatedLines.Any())
            {
                GetOrCreateMarkers();
            }

            if (e.OldViewState.ViewportTop != e.NewViewState.ViewportTop)
                SetTop(_iconCanvas, -_wpfTextViewHost.TextView.ViewportTop);

            OnNewLayout(e.NewOrReformattedLines, e.TranslatedLines);
        }

        private void Selection_SelectionChanged(object sender, EventArgs e)
        {
            // TODO reconcile this!
            // var textSelection = sender as ITextSelection;

            if (!_openCommentOnSelect) return;

            if (_toolWindowProvider.IsVisible(Guids.WebViewToolWindowGuid))
            {
                _events.Publish(new TextSelectionChangedEvent());
            }
        }

        private void Show()
        {
            Visibility = Visibility.Visible;
            Width = MARGIN_WIDTH;
        }

        private void Hide()
        {
            Visibility = Visibility.Hidden;
            Width = 0;
        }

        private void Toggle(bool isVisible)
        {
            if (isVisible)
            {
                Show();
            }
            else
            {
                Hide();
            }
        }

        #region IWpfTextViewMargin

        /// <summary>
        /// Gets the <see cref="FrameworkElement"/> that implements the visual representation of the margin.
        /// </summary>
        /// <exception cref="ObjectDisposedException">The margin is disposed.</exception>
        public FrameworkElement VisualElement
        {
            // Since this margin implements Canvas, this is the object which renders
            // the margin.
            get
            {
                ThrowIfDisposed();
                return this;
            }
        }

        #endregion

        #region ITextViewMargin

        /// <summary>
        /// Gets the size of the margin.
        /// </summary>
        /// <remarks>
        /// For a horizontal margin this is the height of the margin,
        /// since the width will be determined by the <see cref="ITextView"/>.
        /// For a vertical margin this is the width of the margin,
        /// since the height will be determined by the <see cref="ITextView"/>.
        /// </remarks>
        /// <exception cref="ObjectDisposedException">The margin is disposed.</exception>
        public double MarginSize
        {
            get
            {
                ThrowIfDisposed();

                // Since this is a horizontal margin, its width will be bound to the width of the text view.
                // Therefore, its size is its height.
                return ActualWidth;
            }
        }

        /// <summary>
        /// Gets a value indicating whether the margin is enabled.
        /// </summary>
        /// <exception cref="ObjectDisposedException">The margin is disposed.</exception>
        public bool Enabled
        {
            get
            {
                ThrowIfDisposed();

                // The margin should always be enabled
                return true;
            }
        }

        /// <summary>
        /// Gets the <see cref="ITextViewMargin"/> with the given <paramref name="marginName"/> or null if no match is found
        /// </summary>
        /// <param name="marginName">The name of the <see cref="ITextViewMargin"/></param>
        /// <returns>The <see cref="ITextViewMargin"/> named <paramref name="marginName"/>, or null if no match is found.</returns>
        /// <remarks>
        /// A margin returns itself if it is passed its own name. If the name does not match and it is a container margin, it
        /// forwards the call to its children. Margin name comparisons are case-insensitive.
        /// </remarks>
        /// <exception cref="ArgumentNullException"><paramref name="marginName"/> is null.</exception>
        public ITextViewMargin GetTextViewMargin(string marginName)
        {
            // ReSharper disable once ArrangeStaticMemberQualifier
            return string.Equals(marginName, PredefinedCodestreamNames.CodemarkTextViewMargin, StringComparison.OrdinalIgnoreCase) ? this : null;
        }

        /// <summary>
        /// Disposes an instance of <see cref="CodemarkTextViewMargin"/> class.
        /// </summary>
        public void Dispose()
        {
            if (!_isDisposed)
            {
                _textView.LayoutChanged -= TextView_LayoutChanged;
                _textView.Selection.SelectionChanged -= Selection_SelectionChanged;
                _wpfTextViewHost.TextView.ZoomLevelChanged -= TextView_ZoomLevelChanged;
                _tagAggregator?.Dispose();
                _disposables.Dispose();

                _lineInfos?.Clear();
                _iconCanvas?.Children.Clear();

                _markers = null;
                _isDisposed = true;
            }
        }

        #endregion

        /// <summary>
        /// Checks and throws <see cref="ObjectDisposedException"/> if the object is disposed.
        /// </summary>
        private void ThrowIfDisposed()
        {
            if (_isDisposed)
            {
                throw new ObjectDisposedException(PredefinedCodestreamNames.CodemarkTextViewMargin);
            }
        }
    }
}
