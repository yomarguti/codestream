using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;

namespace CodeStream.VisualStudio.Commands
{
    internal class TeamCommand : CommandBase
    {
        public static TeamCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new TeamCommand(package, commandService);
        }

        private TeamCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));
            var menuCommandID = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.TeamCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandID);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        private void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var command = sender as OleMenuCommand;
            if (command == null) return;

            var session = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            var ready = session?.IsReady == true;
            if (ready)
            {
                command.Visible = session?.IsReady == true;
                command.Text = $"Team: {session.User.TeamName}";
            }
            else
            {
                command.Visible = false;
            }
        }

        private void InvokeHandler(object sender, EventArgs args)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            // noop
        }
    }
}