using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.ComponentModel.Design;
using System.Diagnostics.CodeAnalysis;
using System.Diagnostics.Contracts;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.ComponentModelHost;

namespace CodeStream.VisualStudio
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", "0.1", IconResourceID = 400)] // Info on this package for Help/About
    [ProvideOptionPage(typeof(OptionsDialogPage), "CodeStream", "Settings", 0, 0, true)]
    [Guid(Guids.CodeStreamPackageId)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.NoSolution_string, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionExists_string, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionHasMultipleProjects_string, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionHasSingleProject_string, PackageAutoLoadFlags.BackgroundLoad)]
    //[SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    public sealed class CodeStreamPackage : AsyncPackage
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamPackage>();

        private VsShellEventManager _vsEventManager;
        private IDisposable _languageServerReadyEvent;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            // kick it off!
            var SCodeStreamServiceProvider = await GetServiceAsync(typeof(SCodeStreamServiceProvider));

            var iVsMonitorSelection = (IVsMonitorSelection)await GetServiceAsync(typeof(SVsShellMonitorSelection));
            var codeStreamService = await GetServiceAsync(typeof(SCodeStreamService)) as ICodeStreamService;
            var eventAggregator = await GetServiceAsync(typeof(SEventAggregator)) as IEventAggregator;

            Contract.Assume(codeStreamService != null);
            Contract.Assume(eventAggregator != null);

            _vsEventManager = new VsShellEventManager(iVsMonitorSelection);

            _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
            {
                var codeStreamEvents = new CodeStreamEventManager(codeStreamService);
                _vsEventManager.WindowFocusChanged += codeStreamEvents.OnWindowFocusChanged;
            });

            Log.Information("Initializing GitHub Extension v{PackageVersion} in {$ProductName} ({$ProductVersion})",
                Application.Version, Application.ProductName, Application.ProductVersion);

            // Avoid delays when there is ongoing UI activity.
            // See: https://github.com/github/VisualStudio/issues/1537
            await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, InitializeMenusAsync);
        }

        async System.Threading.Tasks.Task InitializeMenusAsync()
        {
            var componentModel = (IComponentModel)(await GetServiceAsync(typeof(SComponentModel)));
            var exports = componentModel.DefaultExportProvider;

            var commands = new IVsCommandBase[]
            {
                exports.GetExportedValue<IToggleToolWindowCommand>(),
                exports.GetExportedValue<ISignOutCommand>(),
            };

            var menuService = (IMenuCommandService)(await GetServiceAsync(typeof(IMenuCommandService)));
            menuService.AddCommands(commands);
        }

        protected override void Dispose(bool disposing)
        {
            _languageServerReadyEvent.Dispose();
            _vsEventManager.Dispose();

            base.Dispose(disposing);
        }
    }
}
