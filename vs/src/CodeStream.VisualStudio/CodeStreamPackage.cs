using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;

namespace CodeStream.VisualStudio
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", "0.1.0", IconResourceID = 400)] // Info on this package for Help/About
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

        private Lazy<ICodeStreamService> _codeStreamService;
        private IDisposable _languageServerReadyEvent;
        private Action _disposableActions = null;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            // kick it off!
            await GetServiceAsync(typeof(SToolWindowProvider));

            Log.Verbose(@"
   ___          _      __ _                            
  / __\___   __| | ___/ _\ |_ _ __ ___  __ _ _ __ ___  
 / /  / _ \ / _` |/ _ \ \| __| '__/ _ \/ _` | '_ ` _ \ 
/ /__| (_) | (_| |  __/\ \ |_| | |  __/ (_| | | | | | |
\____/\___/ \__,_|\___\__/\__|_|  \___|\__,_|_| |_| |_|
                                                       ");            
            Log.Information("Initializing CodeStream Extension v{PackageVersion} in {$VisualStudioName} ({$VisualStudioVersion})",
    Application.ExtensionVersionShort, Application.VisualStudioName, Application.VisualStudioVersion);

            await InitializeLoggingAsync();

            var eventAggregator = await GetServiceAsync(typeof(SEventAggregator)) as IEventAggregator;

            // TODO move this into a non-static??
            InfoBarProvider.Initialize(this);            

            _codeStreamService = new Lazy<ICodeStreamService>(() => GetService(typeof(SCodeStreamService)) as ICodeStreamService);

            // ReSharper disable once PossibleNullReferenceException
            _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
            {
                ThreadHelper.ThrowIfNotOnUIThread();
                var iVsMonitorSelection = GetService(typeof(SVsShellMonitorSelection)) as IVsMonitorSelection;              
                _disposableActions = new CodeStreamEventManager(new VsShellEventManager(iVsMonitorSelection), _codeStreamService).Register(_languageServerReadyEvent);
            });

            // Avoid delays when there is ongoing UI activity.
            // See: https://github.com/github/VisualStudio/issues/1537
            await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, InitializeMenusAsync);
        }

        /// <summary>
        /// Set pfCanClose=false to prevent a tool window from closing
        /// </summary>
        /// <returns></returns>
        protected override int QueryClose(out bool pfCanClose)
        {
            pfCanClose = true;
            if (pfCanClose)
            {
                if (_disposableActions != null)
                {
                    _disposableActions.Invoke();
                }

                _codeStreamService?.Value?.BrowserService?.Dispose();
            }

            return VSConstants.S_OK;
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
                    else if (args.PropertyName == nameof(packageSettings.WebAppUrl) ||
                             args.PropertyName == nameof(packageSettings.ServerUrl) ||
                             args.PropertyName == nameof(packageSettings.Team))
                    {
                        Log.Verbose($"Url(s) or Team changed");
                        if (_codeStreamService?.Value?.BrowserService != null)
                        {
                            _codeStreamService?.Value?.BrowserService?.ReloadWebView();
                        }                        
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
    }
}
