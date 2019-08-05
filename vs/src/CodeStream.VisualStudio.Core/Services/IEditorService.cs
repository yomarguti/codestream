using System;
using System.Runtime.InteropServices;
using CodeStream.VisualStudio.Core.Models;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.Core.Services {
	[Guid("278C1E14-E429-4364-8B73-BB643C041274")]
	public interface IEditorService {
		EditorState GetActiveEditorState();
		EditorState GetEditorState(IWpfTextView wpfTextView);
		EditorContext GetEditorContext();
		ActiveTextEditorSelection GetActiveTextEditorSelection();
		ActiveTextEditor GetActiveTextEditor(Uri uri = null);
		ActiveTextEditor GetActiveTextEditor(ITextDocumentFactoryService textDocumentFactoryService,
			IWpfTextView wpfTextView);
	}
}
