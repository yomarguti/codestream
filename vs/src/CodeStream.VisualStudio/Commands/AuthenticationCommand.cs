using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;
using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell.Interop;
using SCodeStreamService = CodeStream.VisualStudio.Services.SCodeStreamService;

namespace CodeStream.VisualStudio.Commands
{
    internal class AuthenticationCommand
    {
        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            OleMenuCommandService commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AuthenticationCommand(package, commandService);
        }

        private AuthenticationCommand(AsyncPackage package, OleMenuCommandService commandService)
        {
            this.package = package ?? throw new ArgumentNullException(nameof(package));
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandID = new CommandID(PackageGuids.guidVSPackageCommandTopMenuCmdSet, PackageIds.AuthenticationCommandId);
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

                myCommand.Text = session?.IsReady == true ? "Sign out" : "Sign in";
            }
        }

        public static AuthenticationCommand Instance
        {
            get;
            private set;
        }

        private readonly AsyncPackage package;

        /// <summary>
        /// Gets the service provider from the owner package.
        /// </summary>
        private Microsoft.VisualStudio.Shell.IAsyncServiceProvider ServiceProvider
        {
            get
            {
                return this.package;
            }
        }

        /// <summary>
        /// This is the function that is called when the user clicks on the menu command.
        /// It will check that the selected object is actually an instance of this class and
        /// increment its click counter.
        /// </summary>
        private void ClickCallback(object sender, EventArgs args)
        {
            var session = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            if (session?.IsReady == true)
            {
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                    var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
                    if (codeStreamService != null)
                    {
                        await codeStreamService.LogoutAsync();
                    }
                });
            }
            else
            {
                ToolWindowPane window = this.package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
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