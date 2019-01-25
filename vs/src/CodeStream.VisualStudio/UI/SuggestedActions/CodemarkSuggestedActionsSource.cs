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

namespace CodeStream.VisualStudio.UI.SuggestedActions
{
    internal class CodemarkSuggestedActionsSource : ISuggestedActionsSource
    {
        // ReSharper disable once NotAccessedField.Local
        private readonly CodemarkSuggestedActionsSourceProvider _actionsSourceProvider;
        private readonly ITextBuffer _textBuffer;
        // ReSharper disable once NotAccessedField.Local
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

        private SelectedText _selectedText;

        public IEnumerable<SuggestedActionSet> GetSuggestedActions(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            if (_selectedText?.HasText == false || !_textDocumentFactoryService.TryGetTextDocument(_textBuffer, out var textDocument))
            {
                return Enumerable.Empty<SuggestedActionSet>();
            }

            return new[]
            {
                new SuggestedActionSet(
                    actions: new ISuggestedAction[]
                    {
                        new CodemarkSuggestedAction(textDocument, _selectedText)
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
            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            if (sessionService == null || sessionService.IsReady == false) return System.Threading.Tasks.Task.FromResult(false);

            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
            _selectedText = ideService?.GetSelectedText();

            return System.Threading.Tasks.Task.FromResult(_selectedText?.HasText == true);
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
            if (codeStreamService == null) return;

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await codeStreamService.PostCodeAsync(
                        new Uri(_textDocument.FilePath),
                        _selectedText,
                        _textDocument.IsDirty,
                        true,
                        cancellationToken);
            });
        }

        public Task<object> GetPreviewAsync(CancellationToken cancellationToken)
        {
            // nothing here, but here is an example:

            //var textBlock = new TextBlock
            //{
            //    Padding = new Thickness(5)
            //};
            //textBlock.Inlines.Add(new Run() { Text = _selectedText.Text });

            return System.Threading.Tasks.Task.FromResult<object>(null);
        }

        public bool TryGetTelemetryId(out Guid telemetryId)
        {
            // This is a sample action and doesn't participate in LightBulb telemetry  
            telemetryId = Guid.Empty;
            return false;
        }

        public bool HasActionSets => false;

        public string DisplayText { get; } = $"Add {Application.Name} Comment";

        public ImageMoniker IconMoniker => default(ImageMoniker);

        public string IconAutomationText => null;

        public string InputGestureText => null;

        public bool HasPreview => false;

        public void Dispose()
        {
        }
    }
}
