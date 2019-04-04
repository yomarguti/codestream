using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Controllers;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.LSP;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Events;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.Design;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Packages
{
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(WebViewToolWindowPane), Orientation = ToolWindowOrientation.Right,
        Window = EnvDTE.Constants.vsWindowKindSolutionExplorer,
        Style = VsDockStyle.Tabbed)]
    [Guid(PackageGuids.guidWebViewPackageString)]
    [ProvideOptionPage(typeof(OptionsDialogPage), "CodeStream", "Settings", 0, 0, true)]
	[ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.NoSolution)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.EmptySolution)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionExists)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionHasMultipleProjects)]
    [ProvideToolWindowVisibility(typeof(WebViewToolWindowPane), UIContextGuids.SolutionHasSingleProject)]
    [SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    public sealed class WebViewPackage : AsyncPackage
    {
        private Lazy<ICodeStreamService> _codeStreamService;
        private ISettingsService _settingsService;
        private IDisposable _languageServerReadyEvent;
        private VsShellEventManager _vsShellEventManager;
        private CodeStreamEventManager _codeStreamEventManager;
        private bool _hasOpenedSolutionOnce = false;
        private readonly object _eventLocker = new object();
        private bool _initializedEvents;

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

            var isSolutionLoaded = await IsSolutionLoadedAsync();

            if (isSolutionLoaded)
            {
                OnAfterOpenSolution();
            }

            SolutionEvents.OnAfterOpenSolution += OnAfterOpenSolution;

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            AsyncPackageHelper.InitializePackage(GetType().Name);

            await WebViewToggleCommand.InitializeAsync(this);
            await AuthenticationCommand.InitializeAsync(this);
            await UserCommand.InitializeAsync(this);

            await AddCodemarkCommentCommand.InitializeAsync(this);
            await AddCodemarkIssueCommand.InitializeAsync(this);
            await AddCodemarkBookmarkCommand.InitializeAsync(this);
            await AddCodemarkPermalinkCommand.InitializeAsync(this);
            await AddCodemarkPermalinkInstantCommand.InitializeAsync(this);

            await WebViewReloadCommand.InitializeAsync(this);

#if DEBUG
            // only show this locally
            await WebViewDevToolsCommand.InitializeAsync(this);
#endif
	        await BookmarkShortcutCommands.InitializeAllAsync(this);

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
                    var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                    _vsShellEventManager = new VsShellEventManager(Package.GetGlobalService(typeof(SVsShellMonitorSelection)) as IVsMonitorSelection);
                    _codeStreamService = new Lazy<ICodeStreamService>(() => GetService(typeof(SCodeStreamService)) as ICodeStreamService);

                    if (sessionService?.IsAgentReady == true)
                    {
                        InitializeEvents();
                    }
                    else
                    {
                        // ReSharper disable once PossibleNullReferenceException
                        _languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                        {
                            ThreadHelper.ThrowIfNotOnUIThread();

                            InitializeEvents();
                        });
                    }

                    // Avoid delays when there is ongoing UI activity.
                    // See: https://github.com/github/VisualStudio/issues/1537
                    await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, OnSolutionLoadedInitialAsync);
                    _hasOpenedSolutionOnce = true;
                });
            }
        }

        private void InitializeEvents()
        {
            // don't invert if -- this is the double 'null' locking check pattern
            // ReSharper disable InvertIf
            if (!_initializedEvents)
            {
                lock (_eventLocker)
                {
                    if (!_initializedEvents)
                    {
                        _codeStreamEventManager = new CodeStreamEventManager(_vsShellEventManager, _codeStreamService);
                        _initializedEvents = true;
                    }
                }
            }
            // ReSharper restore InvertIf
        }

        private void DialogPage_PropertyChanged(object sender, PropertyChangedEventArgs args)
        {
            if (_settingsService == null)
            {
                Log.Warning($"{nameof(DialogPage_PropertyChanged)} SettingsService is null");
                return;
            }

            if (args.PropertyName == nameof(_settingsService.TraceLevel))
            {
                LogManager.SetTraceLevel(_settingsService.TraceLevel);
            }
            else if (
                args.PropertyName == nameof(_settingsService.ShowAvatars) ||
                args.PropertyName == nameof(_settingsService.ShowMarkerGlyphs) ||
                args.PropertyName == nameof(_settingsService.MuteAll) ||
                args.PropertyName == nameof(_settingsService.ViewCodemarksInline)
                )
            {
                OptionsDialogPage odp = sender as OptionsDialogPage;
                if (odp == null) return;

                var eventAggregator = GetService(typeof(SEventAggregator)) as IEventAggregator;
                var webviewIpc = GetService(typeof(SWebviewIpc)) as IWebviewIpc;
                var configurationController = new ConfigurationController(eventAggregator, webviewIpc);
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    switch (args.PropertyName)
                    {
                        case nameof(_settingsService.ShowAvatars):
                            await configurationController.ToggleShowAvatarsAsync(odp.ShowAvatars);
                            break;
                        case nameof(_settingsService.ShowMarkerGlyphs):
                            await configurationController.ToggleShowMarkerGlyphsAsync(odp.ShowMarkerGlyphs);
                            break;
                        case nameof(_settingsService.MuteAll):
                            await configurationController.ToggleMuteAllAsync(odp.MuteAll);
                            break;
                        case nameof(_settingsService.ViewCodemarksInline):
                            await configurationController.ToggleViewCodemarksInlineAsync(odp.ViewCodemarksInline);
                            break;
                    }
                });
            }
            else if (args.PropertyName == nameof(_settingsService.WebAppUrl) ||
                     args.PropertyName == nameof(_settingsService.ServerUrl) ||
                     args.PropertyName == nameof(_settingsService.Team) ||
                     args.PropertyName == nameof(_settingsService.ProxyUrl) ||
                     args.PropertyName == nameof(_settingsService.ProxyStrictSsl))
            {
                Log.Information($"Url(s) or Team or Proxy changed");
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
            await System.Threading.Tasks.Task.CompletedTask;
        }

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
                _disposables.DisposeAll();
				LanguageClient.Instance?.Dispose();
            }

            base.Dispose(isDisposing);
        }
    }
}
