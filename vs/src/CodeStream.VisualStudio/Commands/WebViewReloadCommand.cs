using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Commands
{
    internal sealed class WebViewReloadCommand : CommandBase
    {
        public static WebViewReloadCommand Instance { get; private set; }

        private WebViewReloadCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewReloadCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        public void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var command = sender as OleMenuCommand;
            if (command == null) return;

            var sessionService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

            command.Visible = sessionService?.IsReady == true;
        }

        public static async Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            OleMenuCommandService commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new WebViewReloadCommand(package, commandService);
        }

        private void InvokeHandler(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var browserService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            browserService?.ReloadWebView();
        }
    }
}
