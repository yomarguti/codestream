using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.UI.SuggestedActions
{
    [Export(typeof(ISuggestedActionsSourceProvider))]
    [Name("CodeStream Codemark")]
    [ContentType("text")]
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
            return textBuffer == null || textView == null
                ? null
                : new CodemarkSuggestedActionsSource(this, textView, textBuffer, _textDocumentFactoryService);
        }
    }
}
