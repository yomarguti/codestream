using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Controllers;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.LSP;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI;
using CodeStream.VisualStudio.UI.Settings;
using CodeStream.VisualStudio.UI.ToolWindows;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Commands;
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
using Microsoft.VisualStudio.ComponentModelHost;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Packages {
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
	[ProvideOptionPage(typeof(DialogPageProvider.General), "CodeStream", "Settings", 0, 0, true)]
	[SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
	public sealed class WebViewPackage : AsyncPackage {
		private static readonly ILogger Log = LogManager.ForContext<WebViewPackage>();
		private ISettingsService _settingsService;
		private IDisposable _languageServerReadyEvent;
		private VsShellEventManager _vsShellEventManager;
		private CodeStreamEventManager _codeStreamEventManager;
		private IComponentModel _componentModel;
		private bool _hasOpenedSolutionOnce = false;
		private readonly object _eventLocker = new object();
		private bool _initializedEvents;
		private List<IDisposable> _disposables;
		private List<VsCommandBase> _commands;
		internal static OptionsDialogPage OptionsDialogPage { get; private set; }

		//public WebViewPackage() {
		//	OptionsDialogPage = GetDialogPage(typeof(OptionsDialogPage)) as OptionsDialogPage;
		//}

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
		protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress) {
			try {
				await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
				_componentModel = GetGlobalService(typeof(SComponentModel)) as IComponentModel;

				var isSolutionLoaded = await IsSolutionLoadedAsync();
				if (isSolutionLoaded) {
					OnAfterBackgroundSolutionLoadComplete();
				}

				SolutionEvents.OnAfterBackgroundSolutionLoadComplete += OnAfterBackgroundSolutionLoadComplete;
				_settingsService = _componentModel.GetService<ISettingsService>();

				InitializeLogging();
				AsyncPackageHelper.InitializePackage(GetType().Name);

				await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, InitializeCommandsAsync);

				await base.InitializeAsync(cancellationToken, progress);
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(InitializeAsync));
			}
		}

		private async Task InitializeCommandsAsync() {
			try {
				var userCommand = new UserCommand();

				_commands = new List<VsCommandBase> {
#if DEBUG
					new WebViewDevToolsCommand(),
#endif
					new AddCodemarkCommentCommand(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet),
					new AddCodemarkIssueCommand(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet),
					new AddCodemarkBookmarkCommand(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet),
					new AddCodemarkPermalinkCommand(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet),
					new AddCodemarkPermalinkInstantCommand(PackageGuids.guidWebViewPackageCodeWindowContextMenuCmdSet),

					new AddCodemarkCommentCommand(PackageGuids.guidWebViewPackageShortcutCmdSet),
					new AddCodemarkIssueCommand(PackageGuids.guidWebViewPackageShortcutCmdSet),
					new AddCodemarkBookmarkCommand(PackageGuids.guidWebViewPackageShortcutCmdSet),
					new AddCodemarkPermalinkCommand(PackageGuids.guidWebViewPackageShortcutCmdSet),
					new AddCodemarkPermalinkInstantCommand(PackageGuids.guidWebViewPackageShortcutCmdSet),

					new WebViewReloadCommand(),
					new WebViewToggleCommand(this),
					new AuthenticationCommand(this, _componentModel),
					userCommand
				};
				await JoinableTaskFactory.SwitchToMainThreadAsync();
				await InfoBarProvider.InitializeAsync(this);

				var menuCommandService = (IMenuCommandService)(await GetServiceAsync(typeof(IMenuCommandService)));
				foreach (var command in _commands) {
					menuCommandService.AddCommand(command);
				}
				await BookmarkShortcutRegistration.InitializeAllAsync(this);

				var eventAggregator = _componentModel.GetService<IEventAggregator>();
				_disposables = new List<IDisposable> {
					//when a user has logged in/out we alter the text of some of the commands
					eventAggregator?.GetEvent<SessionReadyEvent>().Subscribe(_ => {
						ThreadHelper.JoinableTaskFactory.Run(async delegate {
							await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
							userCommand.TriggerChange();
						});
					}),
					eventAggregator?.GetEvent<SessionLogoutEvent>().Subscribe(_ => {
						ThreadHelper.JoinableTaskFactory.Run(async delegate {
							await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
							userCommand.TriggerChange();
						});
					})
				};
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(InitializeCommandsAsync));
			}
		}

		void InitializeLogging() {
			if (_settingsService != null && _settingsService.TraceLevel != TraceLevel.Silent) {
				LogManager.SetTraceLevel(_settingsService.TraceLevel);
			}
		}

		/// <summary>
		/// Checks if a solution is open
		/// </summary>
		/// <returns></returns>
		/// <remarks>https://github.com/Microsoft/VSSDK-Extensibility-Samples/blob/master/SolutionLoadEvents/src/VSPackage.cs</remarks>
		private async Task<bool> IsSolutionLoadedAsync() {
			await JoinableTaskFactory.SwitchToMainThreadAsync();
			var solService = await GetServiceAsync(typeof(SVsSolution)) as IVsSolution;
			if (solService == null) return false;
			ErrorHandler.ThrowOnFailure(solService.GetProperty((int)__VSPROPID.VSPROPID_IsSolutionOpen, out object value));
			return value is bool isSolOpen && isSolOpen;
		}

		private void OnAfterBackgroundSolutionLoadComplete(object sender = null, EventArgs e = null) {
			// there is work that needs to be done only after the first time a solution as opened.
			// if it's opened once before, run OnSolutionLoadedAlwaysAsync
			if (_hasOpenedSolutionOnce) {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					await OnSolutionLoadedAlwaysAsync();
				});
			}
			else {
				ThreadHelper.JoinableTaskFactory.Run(async delegate {
					try {
						await JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
						await TryTriggerLspActivationAsync();
						var sessionService = _componentModel.GetService<ISessionService>();


						if (sessionService?.IsAgentReady == true) {
							InitializeEvents();
						}
						else {
							var eventAggregator = _componentModel.GetService<IEventAggregator>();
							// ReSharper disable once PossibleNullReferenceException
							_languageServerReadyEvent = eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(
								_ => {
									ThreadHelper.ThrowIfNotOnUIThread();
									InitializeEvents();
								});
						}

						// Avoid delays when there is ongoing UI activity.
						// See: https://github.com/github/VisualStudio/issues/1537
						await JoinableTaskFactory.RunAsync(VsTaskRunContext.UIThreadNormalPriority, OnSolutionLoadedInitialAsync);
						_hasOpenedSolutionOnce = true;

					}
					catch (Exception ex) {
						Log.Error(ex, nameof(OnAfterBackgroundSolutionLoadComplete));
					}
				});
			}
		}

		/// <summary>
		/// Checks if there are any active documents open -- if not tries to open/close a magic document to trigger LSP activation
		/// </summary>
		/// <returns></returns>
		private async Task TryTriggerLspActivationAsync() {
			var hasActiveEditor = false;
			EnvDTE.DTE dte = null;
			try {
				await JoinableTaskFactory.SwitchToMainThreadAsync();
				dte = GetGlobalService(typeof(EnvDTE.DTE)) as EnvDTE.DTE;
				hasActiveEditor = dte?.Documents?.Count > 0;
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(TryTriggerLspActivationAsync));
			}
			bool? languageClientActivatorResult = null;
			if (!hasActiveEditor) {
				languageClientActivatorResult = await LanguageClientActivator.InitializeAsync(dte);
			}
			Log.Debug($"{nameof(TryTriggerLspActivationAsync)} HasActiveEditor={hasActiveEditor} LanguageClientActivatorResult={languageClientActivatorResult}");

			await System.Threading.Tasks.Task.CompletedTask;
		}

		private void InitializeEvents() {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();
				// don't invert if -- this is the double 'null' locking check pattern
				// ReSharper disable InvertIf
				if (!_initializedEvents) {
					lock (_eventLocker) {
						if (!_initializedEvents) {
							_vsShellEventManager = new VsShellEventManager(GetGlobalService(typeof(SVsShellMonitorSelection)) as IVsMonitorSelection);
							_codeStreamEventManager = new CodeStreamEventManager(_vsShellEventManager, _componentModel.GetService<IBrowserService>());
							_initializedEvents = true;

						}
					}
				}
				// ReSharper restore InvertIf
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(InitializeEvents));
			}
		}

		private void DialogPage_PropertyChanged(object sender, PropertyChangedEventArgs args) {
			if (_settingsService == null) {
				Log.Warning($"{nameof(DialogPage_PropertyChanged)} SettingsService is null");
				return;
			}

			if (args.PropertyName == nameof(_settingsService.TraceLevel)) {
				LogManager.SetTraceLevel(_settingsService.TraceLevel);
			}
			else if (args.PropertyName == nameof(_settingsService.AutoHideMarkers)) {
				var odp = sender as OptionsDialogPage;
				if (odp == null) return;
				var eventAggregator = _componentModel.GetService<IEventAggregator>();
				eventAggregator?.Publish(new AutoHideMarkersEvent { Value = odp.AutoHideMarkers });
			}
			else if (args.PropertyName == nameof(_settingsService.ShowAvatars) ||
				args.PropertyName == nameof(_settingsService.ShowMarkerGlyphs)) {
				var odp = sender as OptionsDialogPage;
				if (odp == null) return;

				var configurationController = new ConfigurationController(
					_componentModel.GetService<IEventAggregator>(),
					_componentModel.GetService<IWebviewIpc>()
				);

				switch (args.PropertyName) {
					case nameof(_settingsService.ShowAvatars):
						configurationController.ToggleShowAvatars(odp.ShowAvatars);
						break;
					case nameof(_settingsService.ShowMarkerGlyphs):
						configurationController.ToggleShowMarkerGlyphs(odp.ShowMarkerGlyphs);
						break;
				}
			}
			else if (args.PropertyName == nameof(_settingsService.WebAppUrl) ||
					 args.PropertyName == nameof(_settingsService.ServerUrl) ||
					 args.PropertyName == nameof(_settingsService.Team) ||
					 args.PropertyName == nameof(_settingsService.ProxyUrl) ||
					 args.PropertyName == nameof(_settingsService.ProxyStrictSsl)) {
				Log.Information($"Url(s) or Team or Proxy changed");
				var sessionService = _componentModel.GetService<ISessionService>();
				if (sessionService?.IsAgentReady == true || sessionService?.IsReady == true) {
					var browserService = _componentModel.GetService<IBrowserService>();
					browserService?.ReloadWebView();
				}
			}
		}

		private async Task OnSolutionLoadedInitialAsync() {
			await OnSolutionLoadedAlwaysAsync();
			if (_settingsService != null) {
				_settingsService.DialogPage.PropertyChanged += DialogPage_PropertyChanged;
			}

			await Task.CompletedTask;
		}

		private async Task OnSolutionLoadedAlwaysAsync() {
			// no-op
			await Task.CompletedTask;
		}

		protected override void Dispose(bool isDisposing) {
			if (isDisposing) {
				try {
#pragma warning disable VSTHRD108
					ThreadHelper.ThrowIfNotOnUIThread();
#pragma warning restore VSTHRD108
					SolutionEvents.OnAfterBackgroundSolutionLoadComplete -= OnAfterBackgroundSolutionLoadComplete;

					if (_settingsService != null && _settingsService.DialogPage != null) {
						_settingsService.DialogPage.PropertyChanged -= DialogPage_PropertyChanged;
					}

					_vsShellEventManager?.Dispose();
					_languageServerReadyEvent?.Dispose();
					_codeStreamEventManager?.Dispose();
					_disposables.DisposeAll();
					LanguageClient.Instance?.Dispose();
				}
				catch (Exception ex) {
					Log.Error(ex, nameof(Dispose));
				}
			}

			base.Dispose(isDisposing);
		}
	}
}
