using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.Text;

namespace CodeStream.VisualStudio.UI.Extensions {
	public static class TextDocumentExtensions {
		/// <summary>
		/// Don't get a textDocument if our secret LSP file is trying to be opened
		/// </summary>
		/// <param name="textDocumentFactoryService"></param>
		/// <param name="textBuffer"></param>
		/// <param name="textDocument"></param>
		/// <returns></returns>
		public static bool TryGetTextDocument(this ITextDocumentFactoryService textDocumentFactoryService, ITextBuffer textBuffer, out ITextDocument textDocument) {
			textDocument = null;
			if (!textDocumentFactoryService.TryGetTextDocument(textBuffer, out ITextDocument td)) {
				return false;
			}

			textDocument = td;
			if (textDocument == null) {
				return false;
			}
			//	if (textDocument.FilePath.EqualsIgnoreCase("temp.txt")) return false;
			return !textDocument.FilePath.EndsWithIgnoreCase(Core.Constants.CodeStreamCodeStream);
		}
	}
}
