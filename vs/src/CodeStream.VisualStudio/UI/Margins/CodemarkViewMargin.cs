using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reactive.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.UI.Margins
{
    /// <summary>
    /// Margin's canvas and visual definition including both size and content
    /// </summary>
    internal class CodemarkViewMargin : Canvas, IWpfTextViewMargin
    {
        /// <summary>
        /// Margin name.
        /// </summary>
        public const string MarginName = "CodeStreamMargin";

        /// <summary>
        /// A value indicating whether the object is disposed.
        /// </summary>
        private bool _isDisposed;
        private readonly IWpfTextView _textView;
        private readonly IEventAggregator _events;
        private readonly IToolWindowProvider _toolWindowProvider;
        private readonly IEventAggregator _eventAggregator;
        private readonly ICodeStreamAgentService _agentService;
        private readonly List<IDisposable> _disposables;
        private bool _initialized;
        private readonly ITextDocument _textDocument;
        private DocumentMarkersResponse _markerCache;
        private List<CodemarkGlyphCache> _viewCache;

        private bool _openCommentOnSelect;
        private const int DefaultWidth = 20;
        private static readonly ILogger Log = LogManager.ForContext<CodemarkViewMargin>();

        /// <summary>
        /// Initializes a new instance of the <see cref="CodemarkViewMargin"/> class for a given <paramref name="textView"/>.
        /// </summary>
        /// <param name="agentService"></param>
        /// <param name="settingsService"></param>
        /// <param name="textView">The <see cref="IWpfTextView"/> to attach the margin to.</param>
        /// <param name="eventAggregator"></param>
        /// <param name="toolWindowProvider"></param>
        /// <param name="sessionService"></param>
        /// <param name="textDocumentFactoryService"></param>
        public CodemarkViewMargin(
            IEventAggregator eventAggregator,
            IToolWindowProvider toolWindowProvider,
            ISessionService sessionService,
            ICodeStreamAgentService agentService,
            ISettingsService settingsService,
            IWpfTextView textView,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _eventAggregator = eventAggregator;
            _toolWindowProvider = toolWindowProvider;
            _agentService = agentService;
            _openCommentOnSelect = settingsService.OpenCommentOnSelect;
            _textView = textView;

            if (!textDocumentFactoryService.TryGetTextDocument(_textView.TextBuffer, out _textDocument))
            {
                // do something awesome!
            }

            Width = DefaultWidth;
            ClipToBounds = true;

            //Background = new SolidColorBrush(Colors.Cheese);

            _events = new EventAggregator();

            //listening on the main thread since we have to change the UI state
            _disposables = new List<IDisposable> {
                eventAggregator.GetEvent<SessionReadyEvent>().ObserveOnDispatcher()
                .Subscribe(_ =>
                {
                    if (sessionService.IsReady && !_initialized)
                    {
                        Initialize();
                    }
                }),
                eventAggregator.GetEvent<SessionLogoutEvent>().ObserveOnDispatcher()
                .Subscribe(_ => {
                    Hide();
                    _initialized = false;
                }),
                 eventAggregator.GetEvent<CodemarkVisibilityEvent>().ObserveOnDispatcher()
                .Subscribe(_ =>
                {
                    Toggle(_.IsVisible);
                })
            };

            if (sessionService.IsReady && !_initialized)
            {
                Initialize();
            }
            else
            {
                Hide();
            }
        }

        private void Initialize()
        {
            _disposables.Add(
               _eventAggregator.GetEvent<DocumentMarkerChangedEvent>()
              .ObserveOnDispatcher()
              .Throttle(TimeSpan.FromMilliseconds(100))
              .Subscribe(_ =>
              {
                  if (_.Uri.EqualsIgnoreCase(_textDocument.FilePath.ToUri()))
                  {
                      Update();
                  }
              }));
            _disposables.Add(
                _eventAggregator.GetEvent<CodeStreamConfigurationChangedEvent>().ObserveOnDispatcher()
                    .Throttle(TimeSpan.FromMilliseconds(100))
                    .Subscribe(_ => { _openCommentOnSelect = _.OpenCommentOnSelect; }));

            _disposables.Add(_events.GetEvent<TextSelectionChangedEvent>().ObserveOnDispatcher()
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
                                true, CancellationToken.None);
                        });
                    }
                }));

            Show();

            // _textView.TextBuffer.ChangedLowPriority += TextBuffer_ChangedLowPriority;
            _textView.Selection.SelectionChanged += Selection_SelectionChanged;

            _textView.ViewportHeightChanged += TextView_ViewportHeightChanged;
            _textView.LayoutChanged += TextView_LayoutChanged;
            _initialized = true;

            //kick off a change
            Update();
        }

        private DateTime _lastUpdate = DateTime.MinValue;
        private void TextView_LayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            var verticalTranslation = e.VerticalTranslation;
            if (verticalTranslation || e.TranslatedLines.Any())
            {
                if (_lastUpdate == DateTime.MinValue || (DateTime.Now - _lastUpdate) > TimeSpan.FromMilliseconds(20))
                {
                    Update(new TextDocumentChangedEvent
                    {
                        Reason = verticalTranslation
                            ? TextDocumentChangedReason.Scrolled
                            : TextDocumentChangedReason.Edited
                    });
                }
            }
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

        private void TextView_ViewportHeightChanged(object sender, EventArgs e)
        {
            Update(new TextDocumentChangedEvent
            {
                Reason = TextDocumentChangedReason.ViewportHeightChanged
            });
        }

        private void Update(TextDocumentChangedEvent e = null)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await UpdateAsync(e);
            });
        }

        private async System.Threading.Tasks.Task UpdateAsync(TextDocumentChangedEvent e = null)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            if (Visibility == Visibility.Hidden || Width < 1)
            {
                return;
            }

            if (_textDocument == null)
            {
                return;
            }

            var filePath = _textDocument.FilePath;
            if (!Uri.TryCreate(filePath, UriKind.Absolute, out Uri result))
            {
                Log.Verbose($"Could not parse file path as uri={filePath}");
                return;
            }
            //if no cache, or we've gotten here for any other reason except scrolling -- get again
            if (_markerCache == null || e?.Reason != TextDocumentChangedReason.Scrolled)
            {
                _markerCache = await _agentService.GetMarkersForDocumentAsync(result);
            }

            if (_markerCache == null)
            {
                return;
            }

            if (e?.Reason == TextDocumentChangedReason.Scrolled && _viewCache?.Any() == true)
            {
                // if we scrolled, and we have a viewCache -- just reposition them

                var markerOffset = 0;
                foreach (var currentLine in _textView.TextSnapshot.Lines)
                {
                    var codemark = _viewCache.FirstOrDefault(_ => _.StartLine == currentLine.LineNumber + 1);
                    codemark?.Codemark?.Reposition(_textView, markerOffset);

                    markerOffset += (int)_textView.LineHeight;
                }
            }
            else
            {
                _viewCache = new List<CodemarkGlyphCache>();

                Children.Clear();

                var markerOffset = 0;
                foreach (var currentLine in _textView.TextSnapshot.Lines)
                {
                    var startLine = currentLine.LineNumber + 1;
                    var markers = _markerCache?.Markers.Where(_ => _?.Range?.Start.Line == startLine).ToList();
                    if (markers.Any())
                    {
                        var codemark = new Codemark(new CodemarkViewModel(markers.First()));

                        codemark.Reposition(_textView, markerOffset);

                        Children.Add(codemark);

                        _viewCache.Add(new CodemarkGlyphCache(codemark, startLine));
                    }

                    markerOffset += (int)_textView.LineHeight;
                }
            }

            _lastUpdate = DateTime.Now;

            await System.Threading.Tasks.Task.CompletedTask;
        }

        private void Show()
        {
            Visibility = Visibility.Visible;
            Width = DefaultWidth;
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
            return string.Equals(marginName, CodemarkViewMargin.MarginName, StringComparison.OrdinalIgnoreCase) ? this : null;
        }

        /// <summary>
        /// Disposes an instance of <see cref="CodemarkViewMargin"/> class.
        /// </summary>
        public void Dispose()
        {
            if (!_isDisposed)
            {
                // _textView.TextBuffer.ChangedLowPriority -= TextBuffer_ChangedLowPriority;
                _textView.ViewportHeightChanged -= TextView_ViewportHeightChanged;
                _textView.LayoutChanged -= TextView_LayoutChanged;
                _textView.Selection.SelectionChanged -= Selection_SelectionChanged;

                _disposables.Dispose();

                _markerCache = null;
                _viewCache = null;
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
                throw new ObjectDisposedException(MarginName);
            }
        }
    }
}
