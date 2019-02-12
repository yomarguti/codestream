using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;
using System.ComponentModel.Design;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Commands
{
    internal sealed class WebViewToggleCommand : CommandBase
    {
        public static WebViewToggleCommand Instance { get; private set; }
        private ICodeStreamAgentService _codeStreamAgentService;

        private WebViewToggleCommand(AsyncPackage package, OleMenuCommandService commandService, ICodeStreamAgentService codeStreamAgentService) : base(package)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));
            _codeStreamAgentService = codeStreamAgentService;

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewToggleCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        public void DynamicTextCommand_BeforeQueryStatus(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            //var command = sender as OleMenuCommand;
            //if (command == null) return;

            //var windowFrame = GetWindowFrame();
            //if (windowFrame == null) return;
            //if (windowFrame.IsVisible() == VSConstants.S_OK)
            //{
            //    command.Text = $"Hide {Application.Name}";
            //}
            //else
            //{
            //    command.Text = $"Show {Application.Name}";
            //}
        }

        public static async Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            OleMenuCommandService commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            var codeStreamAgentService = await package.GetServiceAsync(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;

            Instance = new WebViewToggleCommand(package, commandService, codeStreamAgentService);
        }

        private void InvokeHandler(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var isVisible = false;
            
            IVsWindowFrame windowFrame = GetWindowFrame();
            if (windowFrame.IsVisible() == VSConstants.S_OK)
            {
                windowFrame.Hide();
            }
            else
            {
                windowFrame.Show();
                isVisible = true;
            }
            
            _codeStreamAgentService.TrackAsync(isVisible ? TelemetryEventNames.WebviewOpened : TelemetryEventNames.WebviewClosed);
        }

        private IVsWindowFrame GetWindowFrame()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            // Get the instance number 0 of this tool window. This window is single instance so this instance
            // is actually the only one.
            // The last flag is set to true so that if the tool window does not exists it will be created.
            ToolWindowPane window = Package.FindToolWindow(typeof(WebViewToolWindowPane), 0, true);
            if ((null == window) || (null == window.Frame))
            {
                throw new NotSupportedException("Cannot create tool window");
            }

            IVsWindowFrame windowFrame = (IVsWindowFrame)window.Frame;
            return windowFrame;
        }
    }
}
