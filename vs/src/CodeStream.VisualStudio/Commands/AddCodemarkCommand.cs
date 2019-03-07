using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.ComponentModel.Design;
using System.Threading;
using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.Commands
{
    internal class AddCodemarkCommand : CommandBase
    {
        public static AddCodemarkCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkCommand(package, commandService);
        }

        private AddCodemarkCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        private void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var command = sender as OleMenuCommand;
            if (command == null) return;

            var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            command.Visible = session?.IsReady == true;
        }

        /// <summary>
        /// This is the function that is called when the user clicks on the menu command.
        /// It will check that the selected object is actually an instance of this class and
        /// increment its click counter.
        /// </summary>
        private void InvokeHandler(object sender, EventArgs args)
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
                //await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                await codeStreamService.NewCodemarkAsync(new Uri(textDocument.FilePath), selectedText, CodemarkType.Comment, CancellationToken.None);
            });
        }
    }
}