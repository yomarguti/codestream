using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Models;
using Microsoft.VisualStudio.Text;

namespace CodeStream.VisualStudio.Core.UI.Extensions {
	public static class TextDocumentExtensions {
		/// <summary>
		/// Don't get a textDocument if our secret LSP file is trying to be opened
		/// </summary>
		/// <param name="textDocumentFactoryService"></param>
		/// <param name="textBuffer"></param>
		/// <param name="textDocument"></param>
		/// <returns></returns>
		public static bool TryGetTextDocument(this ITextDocumentFactoryService textDocumentFactoryService, ITextBuffer textBuffer, out IVirtualTextDocument textDocument) {
			textDocument = null;
			if (!textDocumentFactoryService.TryGetTextDocument(textBuffer, out ITextDocument td)) {
				return false;
			}

			textDocument = VirtualTextDocument.FromTextDocument(td);
			if (textDocument == null) {
				return false;
			}
			
			return !td.FilePath.EndsWithIgnoreCase(Core.Constants.CodeStreamCodeStream);
		}
	}
}
