using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reactive.Linq;
using System.Windows;
using System.Windows.Controls;

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
        private bool isDisposed;
        private IWpfTextView _textView;
        private readonly IEventAggregator _events;
        private readonly IEventAggregator _eventAggregator;
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _agentService;
        private readonly ITextDocumentFactoryService _textDocumentFactoryService;
        private List<IDisposable> _disposables;
        private bool _initialized;
        private ITextDocument _textDocument;
        private DocumentMarkersResponse _markerCache;
        private List<CodemarkGlyphCache> _viewCache;

        /// <summary>
        /// Initializes a new instance of the <see cref="EditorMargin1"/> class for a given <paramref name="textView"/>.
        /// </summary>
        /// <param name="textView">The <see cref="IWpfTextView"/> to attach the margin to.</param>
        public CodemarkViewMargin(
            IEventAggregator eventAggregator,
            ISessionService sessionService,
            ICodeStreamAgentService agentService,
            IWpfTextView textView,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _eventAggregator = eventAggregator;
            _sessionService = sessionService;
            _agentService = agentService;
            _textView = textView;

            _textDocumentFactoryService = textDocumentFactoryService;

            if (!_textDocumentFactoryService.TryGetTextDocument(_textView.TextBuffer, out _textDocument))
            {
                // do something
            }

            Width = 20;
            ClipToBounds = true;

            //Background = new SolidColorBrush(Colors.Cheese);

            _events = new EventAggregator();

            //listening on the main thread since we have to change the UI state
            _disposables = new List<IDisposable>() {
                eventAggregator
                .GetEvent<SessionReadyEvent>()
                .ObserveOnDispatcher()
                .Subscribe(_ =>
                {
                    if (_agentService.IsReady && !_initialized)
                    {
                        Initialize();
                    }
                }),
                eventAggregator.GetEvent<SessionLogoutEvent>()
                .ObserveOnDispatcher()
                .Subscribe(_ =>
                {
                    Visibility = Visibility.Hidden;
                }),
                 eventAggregator.GetEvent<CodemarkVisibilityEvent>()
                .ObserveOnDispatcher()
                .Subscribe(_ =>
                {
                    Visibility = _.IsVisible ? Visibility.Visible : Visibility.Hidden;
                })
            };

            if (_sessionService.IsReady && _agentService.IsReady && !_initialized)
            {
                Initialize();
            }
            else
            {
                Visibility = Visibility.Hidden;
            }
        }

        private void Initialize()
        {
            _disposables.Add(
                _eventAggregator.GetEvent<CodemarkChangedEvent>()
              .Throttle(TimeSpan.FromMilliseconds(100))
              .ObserveOnDispatcher()
              .Subscribe(_ =>
              {
                  //if (new FileUri(_textDocument.FilePath).EqualsIgnoreCase(_.Uri))
                  {
                      Update();
                  }
              }));

            Visibility = Visibility.Visible;
            // _textView.TextBuffer.ChangedLowPriority += TextBuffer_ChangedLowPriority;
            _textView.ViewportHeightChanged += TextView_ViewportHeightChanged;
            _textView.LayoutChanged += TextView_LayoutChanged;
            _initialized = true;

            //kick off a change
            Update();
        }

        private void TextView_LayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            var verticalTranslation = e.VerticalTranslation;
            if (verticalTranslation || e.TranslatedLines.Any())
            {
                Update(new TextDocumentChangedEvent()
                {
                    Reason = verticalTranslation
                    ? TextDocumentChangedReason.Scrolled
                    : TextDocumentChangedReason.Edited
                });
            }
        }

        private void TextView_ViewportHeightChanged(object sender, EventArgs e)
        {
            Update(new TextDocumentChangedEvent()
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
            await System.Threading.Tasks.Task.Yield();

            if (Visibility == Visibility.Hidden)
            {
                return;
            }

            if (_textDocument == null)
            {
                return;
            }

            //if no cache, or we've gotten here for any other reason except scrolling -- reup
            if (_markerCache == null || e?.Reason != TextDocumentChangedReason.Scrolled)
            {
                _markerCache = await _agentService.GetMarkersForDocumentAsync(new Models.FileUri(_textDocument.FilePath));
            }

            if (_markerCache == null)
            {
                return;
            }

            if (e?.Reason == TextDocumentChangedReason.Scrolled && _viewCache?.Any() == true)
            {
                // if we scrolled, and we have a viewCache -- just reposition them

                var currMarkerOffset = 0;
                foreach (var currLine in _textView.TextSnapshot.Lines)
                {
                    var codemark = _viewCache.FirstOrDefault(_ => _.StartLine == currLine.LineNumber + 1);
                    if (codemark?.Codemark != null)
                    {
                        codemark.Codemark.Reposition(_textView, currMarkerOffset);
                    }

                    currMarkerOffset += (int)_textView.LineHeight;
                }
            }
            else
            {
                _viewCache = new List<CodemarkGlyphCache>();

                Children.Clear();

                var currMarkerOffset = 0;
                foreach (var currLine in _textView.TextSnapshot.Lines)
                {
                    var startLine = currLine.LineNumber + 1;
                    var markers = _markerCache?.Markers.Where(_ => _?.Range?.Start.Line == startLine);
                    if (markers.Any())
                    {
                        var codemark = new Codemark(new CodemarkViewModel(markers.First()));

                        codemark.Reposition(_textView, currMarkerOffset);

                        Children.Add(codemark);

                        _viewCache.Add(new CodemarkGlyphCache(codemark, startLine));
                    }

                    currMarkerOffset += (int)_textView.LineHeight;
                }
            }

            await System.Threading.Tasks.Task.CompletedTask;
        }

        #region IWpfTextViewMargin

        /// <summary>
        /// Gets the <see cref="Sytem.Windows.FrameworkElement"/> that implements the visual representation of the margin.
        /// </summary>
        /// <exception cref="ObjectDisposedException">The margin is disposed.</exception>
        public FrameworkElement VisualElement
        {
            // Since this margin implements Canvas, this is the object which renders
            // the margin.
            get
            {
                this.ThrowIfDisposed();
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
                this.ThrowIfDisposed();

                // Since this is a horizontal margin, its width will be bound to the width of the text view.
                // Therefore, its size is its height.
                return this.ActualWidth;
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
                this.ThrowIfDisposed();

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
            return string.Equals(marginName, CodemarkViewMargin.MarginName, StringComparison.OrdinalIgnoreCase) ? this : null;
        }

        /// <summary>
        /// Disposes an instance of <see cref="EditorMargin1"/> class.
        /// </summary>
        public void Dispose()
        {
            if (!this.isDisposed)
            {
                // _textView.TextBuffer.ChangedLowPriority -= TextBuffer_ChangedLowPriority;
                _textView.ViewportHeightChanged -= TextView_ViewportHeightChanged;
                _textView.LayoutChanged -= TextView_LayoutChanged;

                foreach (var disposable in _disposables)
                {
                    disposable?.Dispose();
                }

                GC.SuppressFinalize(this);
                this.isDisposed = true;
            }
        }

        #endregion

        /// <summary>
        /// Checks and throws <see cref="ObjectDisposedException"/> if the object is disposed.
        /// </summary>
        private void ThrowIfDisposed()
        {
            if (this.isDisposed)
            {
                throw new ObjectDisposedException(MarginName);
            }
        }
    }
}
