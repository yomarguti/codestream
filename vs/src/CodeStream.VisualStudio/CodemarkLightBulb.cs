using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Operations;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace CodeStream.VisualStudio
{
    [Export(typeof(ISuggestedActionsSourceProvider))]
    [Name("CodeStream Codemark")]
    [ContentType("any")]
    internal class TestSuggestedActionsSourceProvider : ISuggestedActionsSourceProvider
    {
        [Import(typeof(ITextStructureNavigatorSelectorService))]
        internal ITextStructureNavigatorSelectorService NavigatorService { get; set; }

        private readonly ITextDocumentFactoryService _textDocumentFactoryService;

        [ImportingConstructor]
        internal TestSuggestedActionsSourceProvider(ITextDocumentFactoryService textDocumentFactoryService)
        {
            _textDocumentFactoryService = textDocumentFactoryService;
        }

        public ISuggestedActionsSource CreateSuggestedActionsSource(ITextView textView, ITextBuffer textBuffer)
        {
            return textBuffer == null || textView == null
                ? null
                : new TestSuggestedActionsSource(this, textView, textBuffer, _textDocumentFactoryService);
        }
    }

    internal class TestSuggestedActionsSource : ISuggestedActionsSource
    {
        private readonly TestSuggestedActionsSourceProvider _actionsSourceProvider;
        private readonly ITextBuffer _textBuffer;
        private readonly ITextView _textView;
        private readonly ITextDocumentFactoryService _textDocumentFactoryService;

        public TestSuggestedActionsSource(TestSuggestedActionsSourceProvider actionsSourceProvider, 
            ITextView textView, 
            ITextBuffer textBuffer,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _actionsSourceProvider = actionsSourceProvider;
            _textBuffer = textBuffer;            
            _textView = textView;
            // TODO text of the document has changed...
            //_textBuffer.Changed += TextBuffer_Changed;
            //_textView.Selection.SelectionChanged += Selection_SelectionChanged;
            _textDocumentFactoryService = textDocumentFactoryService;
        }

        //private void Selection_SelectionChanged(object sender, EventArgs e)
        //{
        //    var textSelection = sender as ITextSelection;

        //}

        //private void TextBuffer_Changed(object sender, TextContentChangedEventArgs e)
        //{

        //}

        public bool TryGetTelemetryId(out Guid telemetryId)
        {
            // This is a sample provider and doesn't participate in LightBulb telemetry  
            telemetryId = Guid.Empty;
            return false;
        }

#pragma warning disable 0067
        public event EventHandler<EventArgs> SuggestedActionsChanged;
#pragma warning restore 0067

        public IEnumerable<SuggestedActionSet> GetSuggestedActions(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            var selectedTextService = Package.GetGlobalService(typeof(SSelectedTextService)) as ISelectedTextService;
            var selectedText = selectedTextService.GetSelectedText();

            if (selectedText != null)
            {
                ITextDocument textDocument;
                if (_textDocumentFactoryService.TryGetTextDocument(_textBuffer, out textDocument))
                {                    
                    return new SuggestedActionSet[]
                       {
                        new SuggestedActionSet(new ISuggestedAction[]
                            {
                                new CodemarkSuggestedAction(textDocument, selectedText)
                            }
                        )
                       };
                }
            }

            return Enumerable.Empty<SuggestedActionSet>();
        }

        public Task<bool> HasSuggestedActionsAsync(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult(true);
        }

        public void Dispose()
        {
            //if (_textView?.Selection != null)
            //{
            //    _textView.Selection.SelectionChanged -= Selection_SelectionChanged;
            //}
        }
    }

    internal class CodemarkSuggestedAction : ISuggestedAction
    {
        private string _selectedText;
        private readonly ITextDocument _textDocument;

        public CodemarkSuggestedAction(ITextDocument extDocument, string selectedText)
        {
            _selectedText = selectedText;
            _textDocument = extDocument;
        }

        public Task<IEnumerable<SuggestedActionSet>> GetActionSetsAsync(CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult<IEnumerable<SuggestedActionSet>>(null);
        }

        public void Invoke(CancellationToken cancellationToken)
        {
            // MessageBox.Show(_text);
            // m_span.TextBuffer.Replace(m_span.GetSpan(m_snapshot), m_upper);
            
            var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;                   
            Task<object> task = System.Threading.Tasks.Task.Run<object>(
            async () => {                
                return await codeStreamService.PostCodeAsync(
                    new FileUri(_textDocument.FilePath), 
                    cancellationToken);
            });
        
            var results = task.Result;

        }

        public Task<object> GetPreviewAsync(CancellationToken cancellationToken)
        {
            var textBlock = new TextBlock();
            textBlock.Padding = new Thickness(5);
            textBlock.Inlines.Add(new Run() { Text = _selectedText });

            return System.Threading.Tasks.Task.FromResult<object>(textBlock);
        }

        public bool TryGetTelemetryId(out Guid telemetryId)
        {
            // This is a sample action and doesn't participate in LightBulb telemetry  
            telemetryId = Guid.Empty;
            return false;
        }

        public bool HasActionSets
        {
            get { return false; }
        }

        public string DisplayText { get; } = "CodeStream: Add Comment...";

        public ImageMoniker IconMoniker
        {
            get { return default(ImageMoniker); }
        }

        public string IconAutomationText
        {
            get
            {
                return null;
            }
        }

        public string InputGestureText
        {
            get
            {
                return null;
            }
        }

        public bool HasPreview
        {
            get { return false; }
        }

        public void Dispose()
        {
        }
    }
}
