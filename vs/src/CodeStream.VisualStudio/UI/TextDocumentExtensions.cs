using Microsoft.VisualStudio.Text;
using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.UI
{
    public static class TextDocumentExtensions
    {
        /// <summary>
        /// Don't get a textDocument if our secret LSP file is trying to be opened
        /// </summary>
        /// <param name="textDocumentFactoryService"></param>
        /// <param name="textBuffer"></param>
        /// <param name="textDocument"></param>
        /// <returns></returns>
        public static bool TryGetTextDocument(this ITextDocumentFactoryService textDocumentFactoryService, ITextBuffer textBuffer, out ITextDocument textDocument)
        {
            textDocument = null;
            if (!textDocumentFactoryService.TryGetTextDocument(textBuffer, out ITextDocument td))
            {
                return false;
            }

            textDocument = td;
            if (textDocument == null)
            {
                return false;
            }

            return !textDocument.FilePath.EndsWithIgnoreCase(".codestream");
        }
    }
}
