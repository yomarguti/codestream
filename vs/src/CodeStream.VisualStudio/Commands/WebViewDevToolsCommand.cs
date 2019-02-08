using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;

namespace CodeStream.VisualStudio.Commands
{
    internal class WebViewDevToolsCommand : CommandBase
    {
        public static WebViewDevToolsCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new WebViewDevToolsCommand(package, commandService);
        }

        private WebViewDevToolsCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));
            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewDevToolsCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            commandService.AddCommand(menuItem);
        }

        private void InvokeHandler(object sender, EventArgs args)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var browserService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
            browserService?.OpenDevTools();
        }
    }
}