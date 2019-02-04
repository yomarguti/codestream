using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;

namespace CodeStream.VisualStudio.Commands
{
    internal class UserCommand : CommandBase
    {
        public static UserCommand Instance { get; private set; }

        public static string DefaultText = "Sign In...";

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new UserCommand(package, commandService);
        }

        private UserCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));
            var menuCommandID = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.UserCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandID);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;
            menuItem.Enabled = false;
            commandService.AddCommand(menuItem);
        }

        public void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            var command = sender as OleMenuCommand;
            if (command == null) return;

            var sessionService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            if (sessionService?.IsReady == true)
            {
                var settingsService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
                var env = settingsService?.GetUsefulEnvironmentName();
                var label = env.IsNullOrWhiteSpace() ? sessionService.User.UserName : $"{env}: {sessionService.User.UserName}";
                command.Text = sessionService.User.HasSingleTeam() ? label : $"{label} - {sessionService.User.TeamName}";

                command.Visible = true;
                command.Enabled = true;
            }
            else
            {
                command.Visible = false;
                command.Enabled = false;

                command.Text = DefaultText;
            }
        }

        private void InvokeHandler(object sender, EventArgs args)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            // noop
        }
    }
}