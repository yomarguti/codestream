using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Properties;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.Vssdk;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using CodeStream.VisualStudio.LSP;
using Microsoft.VisualStudio.Shell.Events;
using System.ComponentModel;

namespace CodeStream.VisualStudio.Packages
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", SolutionInfo.Version, IconResourceID = 400)] // Info on this package for Help/About
    [ProvideOptionPage(typeof(OptionsDialogPage), "CodeStream", "Settings", 0, 0, true)]
    [Guid(Guids.CodeStreamPackageId)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionOpening_string, PackageAutoLoadFlags.BackgroundLoad)]
    public sealed class CodeStreamPackage : AsyncPackage
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamPackage>();

        private Lazy<ICodeStreamService> _codeStreamService;
        private ISettingsService _settingsService;
        private IDisposable _languageServerReadyEvent;
        private VsShellEventManager _vsShellEventManager;
        private CodeStreamEventManager _codeStreamEventManager;
        private bool _hasOpenedSolutionOnce = false;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken,
            IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);
            AsyncPackageHelper.InitializePackage(GetType().Name);

            var isSolutionLoaded = await IsSolutionLoadedAsync();

            if (isSolutionLoaded)
            {
                OnAfterOpenSolution();
            }

            SolutionEvents.OnAfterOpenSolution += OnAfterOpenSolution;

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        }

        private async Task<bool> IsSolutionLoadedAsync()
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync();
            var solService = await GetServiceAsync(typeof(SVsSolution)) as IVsSolution;
            
            ErrorHandler.ThrowOnFailure(solService.GetProperty((int)__VSPROPID.VSPROPID_IsSolutionOpen, out object value));

            return value is bool isSolOpen && isSolOpen;
        }

        private void OnAfterOpenSolution(object sender = null, EventArgs e = null)
        {
            if (_hasOpenedSolutionOnce)
            {
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await OnSolutionLoadedAlwaysAsync();
                });
            }
            else
            {
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

                    var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
                    _vsShellEventManager = new VsShellEventManager(Package.GetGlobalService(typeof(SVsShellMonitorSelection)) as IVsMonitorSelection);

                    // ReSharper disable once PossibleNullReferenceException
                    _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                    {
                        ThreadHelper.ThrowIfNotOnUIThread();
                        _codeStreamService = new Lazy<ICodeStreamService>(() => GetService(typeof(SCodeStreamService)) as ICodeStreamService);
                        _codeStreamEventManager = new CodeStreamEventManager(_vsShellEventManager, _codeStreamService);
                    });

                    // Avoid delays when there is ongoing UI activity.
                    // See: https://github.com/github/VisualStudio/issues/1537
                    await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, OnSolutionLoadedInitialAsync);
                    _hasOpenedSolutionOnce = true;
                });
            }
        }

        // Set pfCanClose=false to prevent a tool window from closing
        //protected override int QueryClose(out bool pfCanClose)
        //{
        //    pfCanClose = true;
        //    // ReSharper disable once ConditionIsAlwaysTrueOrFalse
        //    if (pfCanClose)
        //    {
        //    }
        //    return VSConstants.S_OK;
        //}

        protected override void Dispose(bool isDisposing)
        {
            if (isDisposing)
            {
                SolutionEvents.OnAfterOpenSolution -= OnAfterOpenSolution;

                if (_settingsService != null && _settingsService.DialogPage != null)
                {
                    _settingsService.DialogPage.PropertyChanged -= DialogPage_PropertyChanged;
                }

                _vsShellEventManager?.Dispose();
                _languageServerReadyEvent?.Dispose();
                _codeStreamEventManager?.Dispose();
            }

            base.Dispose(isDisposing);
        }

        private void DialogPage_PropertyChanged(object sender, PropertyChangedEventArgs args)
        {
            if (_settingsService == null)
            {
                Log.Verbose($"{nameof(DialogPage_PropertyChanged)} SettingsService is null");
                return;
            }

            if (args.PropertyName == nameof(_settingsService.TraceLevel))
            {
                LogManager.SetTraceLevel(_settingsService.TraceLevel);
            }
            else if (args.PropertyName == nameof(_settingsService.WebAppUrl) ||
                     args.PropertyName == nameof(_settingsService.ServerUrl) ||
                     args.PropertyName == nameof(_settingsService.Team) ||
                     args.PropertyName == nameof(_settingsService.ProxyUrl) ||
                     args.PropertyName == nameof(_settingsService.ProxyStrictSsl))
            {
                Log.Verbose($"Url(s) or Team or Proxy changed");
                var sessionService = GetService(typeof(SSessionService)) as ISessionService;
                if (sessionService?.IsAgentReady == true || sessionService?.IsReady == true)
                {
                    var browserService = GetService(typeof(SBrowserService)) as IBrowserService;
                    browserService?.ReloadWebView();
                }
            }
        }

        private async System.Threading.Tasks.Task OnSolutionLoadedInitialAsync()
        {
            await OnSolutionLoadedAlwaysAsync();
            _settingsService = await GetServiceAsync(typeof(SSettingsService)) as ISettingsService;
            if (_settingsService != null)
            {
                _settingsService.DialogPage.PropertyChanged += DialogPage_PropertyChanged;
            }

            await System.Threading.Tasks.Task.CompletedTask;
        }

        private async System.Threading.Tasks.Task OnSolutionLoadedAlwaysAsync()
        {
            await LanguageClient.TriggerLspInitializeAsync();
        }
    }
}
