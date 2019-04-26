using System;
using System.Threading;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;

namespace CodeStream.VisualStudio.Commands
{
    internal abstract class AddCodemarkCommandBase : VsCommandBase {
		protected AddCodemarkCommandBase(Guid commandSet, int commandId) : base(commandSet, commandId) { }
		protected abstract CodemarkType CodemarkType { get; }

        protected override void ExecuteUntyped(object parameter) {
			var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SCodeStreamService))) as ICodeStreamService;
			if (codeStreamService == null || !codeStreamService.IsReady) return;

			var ideService = Package.GetGlobalService((typeof(SIdeService))) as IdeService;
			if (ideService == null) return;

			var selectedText = ideService.GetActiveEditorState(out IVsTextView view);
			if (view == null) return;

			var componentModel = (IComponentModel)(Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SComponentModel)));
			var exports = componentModel.DefaultExportProvider;

			var wpfTextView = exports.GetExportedValue<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(view);
			if (wpfTextView == null) return;

			if (!exports.GetExportedValue<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) return;

			ThreadHelper.JoinableTaskFactory.Run(async delegate {
				await codeStreamService.NewCodemarkAsync(new Uri(textDocument.FilePath), selectedText, CodemarkType, cancellationToken: CancellationToken.None);
			});
		}

        protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
	        var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
	        sender.Visible = session?.IsReady == true;
		}
    }
}
