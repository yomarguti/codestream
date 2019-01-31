using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;
using System.ComponentModel.Design;
using SCodeStreamService = CodeStream.VisualStudio.Services.SCodeStreamService;

namespace CodeStream.VisualStudio.Commands
{
    internal class AuthenticationCommand : CommandBase
    {
        public static AuthenticationCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AuthenticationCommand(package, commandService);
        }

        private AuthenticationCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandID = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.AuthenticationCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandID);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        private void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var command = sender as OleMenuCommand;
            if (command == null) return;

            var sessionService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            var isReady = sessionService?.IsReady == true;
            if (isReady)
            {
                command.Visible = true;
                command.Text = $"Sign Out {sessionService.User.UserName}";
            }
            else
            {
                command.Visible = false;
            }
        }

        private void InvokeHandler(object sender, EventArgs args)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            if (session?.IsReady == true)
            {
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                    var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
                    if (codeStreamService != null)
                    {
                        await codeStreamService.LogoutAsync();
                    }
                });
            }
            else
            {
                ToolWindowPane window = this.Package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
                if ((null == window) || (null == window.Frame))
                {
                    throw new NotSupportedException("Cannot create tool window");
                }

                IVsWindowFrame windowFrame = (IVsWindowFrame)window.Frame;
                if (windowFrame.IsVisible() == VSConstants.S_OK)
                {
                    // already visible!
                }
                else
                {
                    ErrorHandler.ThrowOnFailure(windowFrame.Show());
                }
            }
        }
    }
}