using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Windows.Controls;
using Microsoft.VisualStudio.ComponentModelHost;

namespace CodeStream.VisualStudio.UI.ToolWindows {
	// ReSharper disable once RedundantExtendsListEntry
	// ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
	public partial class WebViewControl : UserControl, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();

		private readonly IEventAggregator _eventAggregator;
		private readonly IWebviewIpc _ipc;
		private readonly ISessionService _sessionService;
		private readonly IDisposable _languageServerDisconnectedEvent;
		private readonly ICodeStreamService _codeStreamService;
		private IDisposable _languageServerReadyEvent;
		private List<IDisposable> _disposables;
		private bool _disposed = false;
		private bool _isInitialized;
		private static readonly object InitializeLock = new object();

		/// <summary>
		/// Initializes a new instance of the <see cref="WebViewControl"/> class.
		/// </summary>
		public WebViewControl() {
			this.IsVisibleChanged += WebViewControl_IsVisibleChanged;

			InitializeComponent();

			Log.Verbose($"{nameof(OnInitialized)}...");

			_ipc = ServiceLocator.Get<SWebviewIpc, IWebviewIpc>();
			_codeStreamService = ServiceLocator.Get<SCodeStreamService, ICodeStreamService>();

			if (_ipc != null && _ipc.BrowserService != null) {

				_ipc.BrowserService.Initialize();
				_ipc.BrowserService.AttachControl(Grid);
				_ipc.BrowserService.LoadSplashView();

				_eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
				_sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;

				if (_sessionService == null) {
					Log.Warning("SessionService is null");
				}
				else {
					_languageServerDisconnectedEvent = _eventAggregator?.GetEvent<LanguageServerDisconnectedEvent>().Subscribe(_ => {
						_isInitialized = false;

						_ipc.BrowserService.LoadSplashView();

						SetupInitialization();
					});

					SetupInitialization();
				}
			}
			else {
				Log.Warning("BrowserService is null");
			}

			Log.Debug($"{nameof(OnInitialized)}");
		}

		private void WebViewControl_IsVisibleChanged(object sender, System.Windows.DependencyPropertyChangedEventArgs e) {
			var newValue = e.NewValue.AsBool();
			_sessionService.IsWebViewVisible = newValue;

			if (!_sessionService.IsReady) return;

			if (!newValue && e.OldValue.AsBool()) {
				//if is going to hide and the last view IS codemarks for file -- enable it
				if (!_sessionService.AreMarkerGlyphsVisible) {
					_sessionService.AreMarkerGlyphsVisible = true;
					_eventAggregator.Publish(new MarkerGlyphVisibilityEvent { IsVisible = true });
				}
			}
			else if (newValue && !e.OldValue.AsBool()) {
				//if is going to show and the last view is NOT codemarks for file
				var areMarkerGlyphsVisible = !_sessionService.IsCodemarksForFileVisible;
				if (areMarkerGlyphsVisible != _sessionService.AreMarkerGlyphsVisible) {
					_sessionService.AreMarkerGlyphsVisible = areMarkerGlyphsVisible;
					_eventAggregator.Publish(new MarkerGlyphVisibilityEvent { IsVisible = areMarkerGlyphsVisible });
					if (!_sessionService.LastActiveFileUrl.IsNullOrWhiteSpace()) {
						try {
							_codeStreamService?.ChangeActiveEditorAsync(_sessionService.LastActiveFileUrl,
								new Uri(_sessionService.LastActiveFileUrl));
						}
						catch {
							//suffer silently
						}
					}
				}
			}
		}

		private void SetupInitialization() {
			if (_sessionService.IsAgentReady) {
				InitializeCore();
			}
			else {
				if (_languageServerReadyEvent != null) {
					// if we're re-using this... dispose it first.
					_languageServerReadyEvent.Dispose();
				}
				// ReSharper disable once PossibleNullReferenceException
				_languageServerReadyEvent = _eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ => {
					InitializeCore();
				});
			}
		}

		private void InitializeCore() {
			// ReSharper disable InvertIf
			if (!_isInitialized) {
				lock (InitializeLock) {
					if (!_isInitialized) {
						try {
							var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
							var router = new WebViewRouter(
								Package.GetGlobalService(typeof(SCredentialsService)) as ICredentialsService,
								Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
								Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
								Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService,
								_eventAggregator,
								_ipc,
								Package.GetGlobalService(typeof(SIdeService)) as IIdeService,
								componentModel.GetService<IEditorService>());

							_ipc.BrowserService.AddWindowMessageEvent(
								async delegate(object sender, WindowEventArgs ea) { await router.HandleAsync(ea); });

							_ipc.BrowserService.LoadWebView();

							_disposables = new List<IDisposable> {

								_eventAggregator.GetEvent<AuthenticationChangedEvent>()
									.Subscribe(_ => {
										if (_.Reason == LogoutReason.Token) {
											var authenticationService =
												Package.GetGlobalService(typeof(SAuthenticationService)) as
													IAuthenticationService;
											if (authenticationService != null) {
												ThreadHelper.JoinableTaskFactory.Run(async delegate {
													await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
													await authenticationService.LogoutAsync();
												});
											}
										}
										else {
											// TODO: Handle this
										}
									})
							};

							_isInitialized = true;
						}
						catch (Exception ex) {
							Log.Fatal(ex, nameof(InitializeCore));
						}
					}
				}
			}
			// ReSharper restore InvertIf
		}

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed)
				return;

			if (disposing) {
				_languageServerReadyEvent?.Dispose();
				_languageServerDisconnectedEvent?.Dispose();
				_disposables.DisposeAll();
				IsVisibleChanged -= WebViewControl_IsVisibleChanged;
			}

			_disposed = true;
		}
	}
}
