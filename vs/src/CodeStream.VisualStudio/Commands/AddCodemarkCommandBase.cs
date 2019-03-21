using System;
using System.Threading;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;

namespace CodeStream.VisualStudio.Commands
{
    internal abstract class AddCodemarkCommandBase : CommandBase
    {
        protected AddCodemarkCommandBase(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
        }

        protected abstract CodemarkType CodemarkType { get; }

        /// <summary>
        /// This is the function that is called when the user clicks on the menu command.
        /// It will check that the selected object is actually an instance of this class and
        /// increment its click counter.
        /// </summary>
        protected virtual void InvokeHandler(object sender, EventArgs args)
        {
            var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SCodeStreamService))) as ICodeStreamService;
            if (codeStreamService == null || !codeStreamService.IsReady) return;

            var ideService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SIdeService))) as IdeService;
            if (ideService == null) return;

            var selectedText = ideService.GetActiveEditorState(out IVsTextView view);
            if (view == null) return;

            var componentModel = (IComponentModel)(Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SComponentModel)));
            var exports = componentModel.DefaultExportProvider;

            var wpfTextView = exports.GetExportedValue<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(view);
            if (wpfTextView == null) return;

            if (!exports.GetExportedValue<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument)) return;
            
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await codeStreamService.NewCodemarkAsync(new Uri(textDocument.FilePath), selectedText, CodemarkType, cancellationToken: CancellationToken.None);
            });
        }

        protected void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var command = sender as OleMenuCommand;
            if (command == null) return;

            var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            command.Visible = session?.IsReady == true;
        }
    }
}