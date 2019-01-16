using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.ComponentModel.Design;
using System.Threading;

namespace CodeStream.VisualStudio.Commands
{
    internal class AddCodemarkCommand
    {
        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            OleMenuCommandService commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkCommand(package, commandService);
        }

        private AddCodemarkCommand(AsyncPackage package, OleMenuCommandService commandService)
        {
            this._package = package ?? throw new ArgumentNullException(nameof(package));
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandID = new CommandID(PackageGuids.guidVSPackageCommandCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkCommandId);
            var menuItem = new OleMenuCommand(this.ClickCallback, menuCommandID);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;
            commandService.AddCommand(menuItem);
        }

        private void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var myCommand = sender as OleMenuCommand;
            if (myCommand != null)
            {
                var session = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

                myCommand.Visible = session?.IsReady == true;
            }
        }

        public static AddCodemarkCommand Instance
        {
            get;
            private set;
        }

        private readonly AsyncPackage _package;

        /// <summary>
        /// Gets the service provider from the owner package.
        /// </summary>
        private IAsyncServiceProvider ServiceProvider
        {
            get
            {
                return _package;
            }
        }

        /// <summary>
        /// This is the function that is called when the user clicks on the menu command.
        /// It will check that the selected object is actually an instance of this class and
        /// increment its click counter.
        /// </summary>
        private async void ClickCallback(object sender, EventArgs args)
        {
            var ideSerivce = Package.GetGlobalService((typeof(SIdeService))) as IdeService;
            if (ideSerivce == null) return;

            var selectedText = ideSerivce.GetSelectedText(out IVsTextView view);
            if (view != null)
            {
                var componentModel = (IComponentModel)(Package.GetGlobalService(typeof(SComponentModel)));
                var exports = componentModel.DefaultExportProvider;

                var wpfTextView = exports.GetExportedValue<IVsEditorAdaptersFactoryService>()?.GetWpfTextView(view);
                if (wpfTextView != null)
                {
                    if (exports.GetExportedValue<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument))
                    {
                        var codeStreamService = Package.GetGlobalService((typeof(SCodeStreamService))) as ICodeStreamService;
                        if (codeStreamService != null)
                        {
                            ThreadHelper.JoinableTaskFactory.Run(async delegate
                            {
                                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                                await codeStreamService.PostCodeAsync(new Uri(textDocument.FilePath), selectedText,
                                    true, CancellationToken.None);
                            });
                        }
                    }
                }
            }
        }
    }
}