using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio.Shell;
using System;
using System.Collections.Generic;
using System.ComponentModel.Design;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Packages
{
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(WebViewToolWindowPane), Orientation = ToolWindowOrientation.Right,
        Window = EnvDTE.Constants.vsWindowKindSolutionExplorer,
        Style = VsDockStyle.Tabbed)]
    [Guid(PackageGuids.guidWebViewPackageString)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.NoSolution)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.EmptySolution)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionExists)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionHasMultipleProjects)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionHasSingleProject)]
    [SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    public sealed class WebViewPackage : AsyncPackage
    {
        private List<IDisposable> _disposables;

        //protected override int QueryClose(out bool pfCanClose)
        //{
        //    pfCanClose = true;
        //    // ReSharper disable once ConditionIsAlwaysTrueOrFalse
        //    if (pfCanClose)
        //    {
        //    }
        //    return VSConstants.S_OK;
        //}

        /// <summary>
        /// Initialization of the package; this method is called right after the package is sited, so this is the place
        /// where you can put all the initialization code that rely on services provided by VisualStudio.
        /// </summary>
        /// <param name="cancellationToken">A cancellation token to monitor for initialization cancellation, which can occur when VS is shutting down.</param>
        /// <param name="progress">A provider for progress updates.</param>
        /// <returns>A task representing the async work of package initialization, or an already completed task if there is none. Do not return null from this method.</returns>
        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            AsyncPackageHelper.InitializePackage(GetType().Name);

            await WebViewToggleCommand.InitializeAsync(this);
            await AuthenticationCommand.InitializeAsync(this);
            await UserCommand.InitializeAsync(this);
            await AddCodemarkCommand.InitializeAsync(this);
            await WebViewReloadCommand.InitializeAsync(this);

            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
            _disposables = new List<IDisposable>
            {
                eventAggregator?.GetEvent<SessionReadyEvent>().Subscribe(_ =>
                {
                    ThreadHelper.JoinableTaskFactory.Run(async delegate
                    {
                        await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

                        var commandService = await GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
                        var command = commandService?.FindCommand(new CommandID(PackageGuids.guidWebViewPackageCmdSet,
                            PackageIds.UserCommandId));

                        UserCommand.Instance.DynamicTextCommand_BeforeQueryStatus(command, null);
                    });
                }),
                eventAggregator?.GetEvent<SessionLogoutEvent>().Subscribe(_ =>
                {
                    ThreadHelper.JoinableTaskFactory.Run(async delegate
                    {
                        await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

                        var commandService =
                            await GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;
                        var command = commandService?.FindCommand(new CommandID(PackageGuids.guidWebViewPackageCmdSet,
                            PackageIds.UserCommandId));

                        UserCommand.Instance.DynamicTextCommand_BeforeQueryStatus(command, null);
                    });
                })
            };
        }

        protected override void Dispose(bool isDisposing)
        {
            if (isDisposing)
            {
                _disposables.Dispose();
            }

            base.Dispose(isDisposing);
        }
    }
}
