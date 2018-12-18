using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Linq;
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

        private readonly ICodeStreamAgentService _agentService;
        private readonly ITextDocumentFactoryService _textDocumentFactoryService;

        /// <summary>
        /// Initializes a new instance of the <see cref="EditorMargin1"/> class for a given <paramref name="textView"/>.
        /// </summary>
        /// <param name="textView">The <see cref="IWpfTextView"/> to attach the margin to.</param>
        public CodemarkViewMargin(
            ICodeStreamAgentService agentService,
            IWpfTextView textView,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _agentService = agentService;
            _textView = textView;
            _textDocumentFactoryService = textDocumentFactoryService;

            this.Width = 20;
            this.ClipToBounds = true;

            //this.Background = new SolidColorBrush(Colors.Gray);

            if (_agentService.IsReady)
            {
                this.Visibility = Visibility.Visible;
                // Foo();
                _textView.TextBuffer.ChangedLowPriority += TextBuffer_ChangedLowPriority;
                _textView.ViewportHeightChanged += TextView_ViewportHeightChanged;
                _textView.LayoutChanged += TextView_LayoutChanged;
            }
            else
            {
                this.Visibility = Visibility.Hidden;
            }
        }

        //private void UpdateDisplay()
        //{
        //    Dispatcher.BeginInvoke(new Action(Foo), DispatcherPriority.Render);
        //}

        private void TextView_LayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                Foo();
            });

        }

        private void TextView_ViewportHeightChanged(object sender, EventArgs e)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                Foo();
            });
        }

        private void TextBuffer_ChangedLowPriority(object sender, TextContentChangedEventArgs e)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                Foo();
            });
        }

        private IWpfTextView _textView;
        private async System.Threading.Tasks.Task Foo()
        {
            await System.Threading.Tasks.Task.Yield();

            ITextDocument textDocument;
            if (_textDocumentFactoryService.TryGetTextDocument(_textView.TextBuffer, out textDocument))
            {
                var response = await _agentService.GetMarkersForDocumentAsync(new Models.FileUri(textDocument.FilePath));
                if (response != null)
                {
                    var items = new int[] { 6, 18 };
                    Children.Clear();

                    var currMarkerOffset = 0;
                    int i = 1;

                    foreach (var currLine in _textView.TextSnapshot.Lines)
                    {
                        var hasItem = items.Where(_ => _ == currLine.LineNumber + 1);
                        if (hasItem.Any())
                        {
                            var codemark = new Codemark(
                                new CodemarkViewModel()
                                {
                                    Color = "blue",
                                    Type = "comment"
                                });
                            Canvas.SetLeft(codemark, 0);
                            Canvas.SetTop(codemark, currMarkerOffset - _textView.ViewportTop);
                            Children.Add(codemark);
                        }

                        currMarkerOffset += (int)_textView.LineHeight;
                    }
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
                _textView.TextBuffer.ChangedLowPriority -= TextBuffer_ChangedLowPriority;
                _textView.ViewportHeightChanged -= TextView_ViewportHeightChanged;
                _textView.LayoutChanged -= TextView_LayoutChanged;

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
