using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.UI;

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
    public sealed class CodeStreamPackage : AsyncPackage
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamPackage>();

        private VsShellEventManager _vsEventManager;
        private IBrowserService _browserService;
        private IDisposable _languageServerReadyEvent;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);


            // kick it off!
            await GetServiceAsync(typeof(SCodeStreamToolWindowProvider));

            var iVsMonitorSelection = (IVsMonitorSelection)await GetServiceAsync(typeof(SVsShellMonitorSelection));
            var codeStreamService = await GetServiceAsync(typeof(SCodeStreamService)) as ICodeStreamService;
            var eventAggregator = await GetServiceAsync(typeof(SEventAggregator)) as IEventAggregator;
            _browserService = await GetServiceAsync(typeof(SBrowserService)) as IBrowserService;

            InfoBarProvider.Initialize(this);

            Assumes.Present(codeStreamService);
            Assumes.Present(eventAggregator);
            Assumes.Present(_browserService);

            _vsEventManager = new VsShellEventManager(iVsMonitorSelection);

            // ReSharper disable once PossibleNullReferenceException
            _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
            {
                var codeStreamEvents = new CodeStreamEventManager(codeStreamService, _browserService);
                _vsEventManager.WindowFocusChanged += codeStreamEvents.OnWindowFocusChanged;
                _vsEventManager.ThemeChanged += codeStreamEvents.OnThemeChanged;
            });

            await InitializeLoggingAsync();

            Log.Information("Initializing CodeStream Extension v{PackageVersion} in {$FullProductName} ({$ProductVersion})",
                Application.Version, Application.FullProductName, Application.ProductVersion);

            // Avoid delays when there is ongoing UI activity.
            // See: https://github.com/github/VisualStudio/issues/1537
            await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, InitializeMenusAsync);
        }

        async System.Threading.Tasks.Task InitializeLoggingAsync()
        {
            var packageSettings = await GetServiceAsync(typeof(SSettingsService)) as ISettingsService;

            if (packageSettings != null)
            {
                packageSettings.DialogPage.PropertyChanged += (sender, args) =>
                {
                    if (args.PropertyName == nameof(packageSettings.TraceLevel))
                    {
                        LogManager.SetTraceLevel(packageSettings.TraceLevel);
                    }
                };
            }
        }

        async System.Threading.Tasks.Task InitializeMenusAsync()
        {
            var componentModel = (IComponentModel)(await GetServiceAsync(typeof(SComponentModel)));
            var exports = componentModel.DefaultExportProvider;

            var commands = new IVsCommandBase[]
            {
                exports.GetExportedValue<IToggleToolWindowCommand>(),
                exports.GetExportedValue<IAuthenticationCommand>(),
                exports.GetExportedValue<IAddCodemarkCommand>(),
            };

            var menuService = (IMenuCommandService)(await GetServiceAsync(typeof(IMenuCommandService)));
            menuService.AddCommands(commands);
        }

        private bool _disposed;

        protected override void Dispose(bool disposing)
        {
            if (_disposed) return;

            if (disposing)
            {
                _languageServerReadyEvent?.Dispose();
                _browserService?.Dispose();
                _vsEventManager.Dispose();
            }

            base.Dispose(disposing);
            _disposed = true;
        }
    }
}
