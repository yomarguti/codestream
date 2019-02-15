using CodeStream.VisualStudio.Core;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.UI.SuggestedActions
{
    [Export(typeof(ISuggestedActionsSourceProvider))]
    [Name(PredefinedCodestreamNames.CodemarkSuggestedActionsSourceProvider)]
    [ContentType(ContentTypes.Text)]
    internal class CodemarkSuggestedActionsSourceProvider : ISuggestedActionsSourceProvider
    {
        private readonly ITextDocumentFactoryService _textDocumentFactoryService;

        [ImportingConstructor]
        internal CodemarkSuggestedActionsSourceProvider(ITextDocumentFactoryService textDocumentFactoryService)
        {
            _textDocumentFactoryService = textDocumentFactoryService;
        }

        public ISuggestedActionsSource CreateSuggestedActionsSource(ITextView textView, ITextBuffer textBuffer)
        {
            if (textBuffer == null || textView == null) return null;

            if (!TextDocuments.TryGetTextDocument(_textDocumentFactoryService, textBuffer,
                out var textDocument))
            {
                return null;
            }

            return new CodemarkSuggestedActionsSource(this, textView, textBuffer, textDocument);
        }
    }
}
