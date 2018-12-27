using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace CodeStream.VisualStudio.UI.SuggestedActions
{
    internal class CodemarkSuggestedActionsSource : ISuggestedActionsSource
    {
        private readonly CodemarkSuggestedActionsSourceProvider _actionsSourceProvider;
        private readonly ITextBuffer _textBuffer;
        private readonly ITextView _textView;
        private readonly ITextDocumentFactoryService _textDocumentFactoryService;

        public CodemarkSuggestedActionsSource(CodemarkSuggestedActionsSourceProvider actionsSourceProvider,
            ITextView textView,
            ITextBuffer textBuffer,
            ITextDocumentFactoryService textDocumentFactoryService)
        {
            _actionsSourceProvider = actionsSourceProvider;
            _textBuffer = textBuffer;
            _textView = textView;
            _textDocumentFactoryService = textDocumentFactoryService;
        }

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
            var selectedText = selectedTextService?.GetSelectedText();

            if (selectedText == null || !_textDocumentFactoryService.TryGetTextDocument(_textBuffer, out var textDocument))
            {
                return Enumerable.Empty<SuggestedActionSet>();
            }

            return new SuggestedActionSet[]
            {
                new SuggestedActionSet(
                    actions: new ISuggestedAction[]
                    {
                        new CodemarkSuggestedAction(textDocument, selectedText)
                    },
                    categoryName: null,
                    title: null,
                    priority: SuggestedActionSetPriority.None,
                    applicableToSpan: null
                )
            };
        }

        public Task<bool> HasSuggestedActionsAsync(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult(true);
        }

        public void Dispose()
        {

        }
    }

    internal class CodemarkSuggestedAction : ISuggestedAction
    {
        private readonly SelectedText _selectedText;
        private readonly ITextDocument _textDocument;

        public CodemarkSuggestedAction(ITextDocument textDocument, SelectedText selectedText)
        {
            _textDocument = textDocument;
            _selectedText = selectedText;
        }

        public Task<IEnumerable<SuggestedActionSet>> GetActionSetsAsync(CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult<IEnumerable<SuggestedActionSet>>(null);
        }

        public void Invoke(CancellationToken cancellationToken)
        {
            var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await codeStreamService.PostCodeAsync(
                        new FileUri(_textDocument.FilePath),
                        _selectedText,
                        true,
                        cancellationToken);
            });
        }

        public Task<object> GetPreviewAsync(CancellationToken cancellationToken)
        {
            var textBlock = new TextBlock
            {
                Padding = new Thickness(5)
            };
            textBlock.Inlines.Add(new Run() { Text = _selectedText.Text });

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

        public string DisplayText { get; } = "Add CodeStream Comment";

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
