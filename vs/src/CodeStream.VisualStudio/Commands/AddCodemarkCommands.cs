using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using Serilog;

namespace CodeStream.VisualStudio.Commands
{
    internal class AddCodemarkCommentCommand : AddCodemarkCommandBase
    {
        public static AddCodemarkCommentCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkCommentCommand(package, commandService);
        }

        private AddCodemarkCommentCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package, commandService)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkCommentCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        protected override CodemarkType CodemarkType => CodemarkType.Comment;
    }

    internal class AddCodemarkIssueCommand : AddCodemarkCommandBase
    {
        public static AddCodemarkIssueCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkIssueCommand(package, commandService);
        }

        private AddCodemarkIssueCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package, commandService)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkIssueCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        protected override CodemarkType CodemarkType => CodemarkType.Issue;
    }

    internal class AddCodemarkBookmarkCommand : AddCodemarkCommandBase
    {
        public static AddCodemarkBookmarkCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkBookmarkCommand(package, commandService);
        }

        private AddCodemarkBookmarkCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package, commandService)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkBookmarkCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        protected override CodemarkType CodemarkType => CodemarkType.Bookmark;
    }

    internal class AddCodemarkPermalinkCommand : AddCodemarkCommandBase
    {
        public static AddCodemarkPermalinkCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkPermalinkCommand(package, commandService);
        }

        private AddCodemarkPermalinkCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package, commandService)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkPermalinkCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        protected override CodemarkType CodemarkType => CodemarkType.Link;
    }

    internal class AddCodemarkPermalinkInstantCommand : AddCodemarkCommandBase
    {
        private static readonly ILogger Log = LogManager.ForContext<AddCodemarkPermalinkInstantCommand>();
        public static AddCodemarkPermalinkInstantCommand Instance { get; private set; }

        public static async System.Threading.Tasks.Task InitializeAsync(AsyncPackage package)
        {
            // Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires
            // the UI thread.
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
            Instance = new AddCodemarkPermalinkInstantCommand(package, commandService);
        }

        private AddCodemarkPermalinkInstantCommand(AsyncPackage package, OleMenuCommandService commandService) : base(package, commandService)
        {
            commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));

            var menuCommandId = new CommandID(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet, PackageIds.AddCodemarkPermalinkInstantCommandId);
            var menuItem = new OleMenuCommand(InvokeHandler, menuCommandId);
            menuItem.BeforeQueryStatus += DynamicTextCommand_BeforeQueryStatus;

            commandService.AddCommand(menuItem);
        }

        protected override CodemarkType CodemarkType => CodemarkType.Link;

        protected override void InvokeHandler(object sender, EventArgs args)
        {
            var agentService = Microsoft.VisualStudio.Shell.Package.GetGlobalService((typeof(SCodeStreamAgentService))) as ICodeStreamAgentService;
            if (agentService == null) return;

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
                try
                {
                    var response = await agentService.CreatePermalinkAsync(selectedText.Range, textDocument.FilePath.ToUri().ToString(),
                        "private");
                    if (response != null)
                    {
                        await ideService.SetClipboardAsync(response.LinkUrl);
                        //InfoBarProvider.Instance.ShowInfoBar($"Copied {foo.LinkUrl} to your clipboard");
                    }
                }
                catch(Exception ex)
                {
                    Log.Warning(ex, nameof(InvokeHandler));
                }
            });
        }
    }
}
