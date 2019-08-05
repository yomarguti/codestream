using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.UI.ToolWindows {
	// ReSharper disable once RedundantExtendsListEntry
	// ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
	public partial class WebViewControl : UserControl, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();

		private readonly IComponentModel _componentModel;
		private readonly IEventAggregator _eventAggregator;
		private readonly IBrowserService _browserService;
		private readonly ISessionService _sessionService;
		private readonly IDisposable _languageServerDisconnectedEvent;

		private IDisposable _languageServerReadyEvent;		
		private bool _disposed = false;
		private bool _isInitialized;
		private static readonly object InitializeLock = new object();

		/// <summary>
		/// Initializes a new instance of the <see cref="WebViewControl"/> class.
		/// </summary>
		public WebViewControl() {
			try {
				this.IsVisibleChanged += WebViewControl_IsVisibleChanged;

				InitializeComponent();

				Log.Verbose($"{nameof(OnInitialized)}...");
				_componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				Assumes.Present(_componentModel);

				_eventAggregator = _componentModel.GetService<IEventAggregator>();
				_sessionService = _componentModel.GetService<ISessionService>();
				_browserService = _componentModel.GetService<IBrowserService>();

				_browserService.Initialize();
				_browserService.AttachControl(Grid);
				_browserService.LoadSplashView();

				if (_sessionService == null) {
					Log.Error("SessionService is null");
				}
				else {
					_languageServerDisconnectedEvent = _eventAggregator?.GetEvent<LanguageServerDisconnectedEvent>()
						.Subscribe(_ => {
							_isInitialized = false;

							_browserService.LoadSplashView();

							SetupInitialization();
						});

					SetupInitialization();
				}
				Log.Debug($"{nameof(OnInitialized)}");
			}
			catch (Exception ex) {
				Log.Fatal(ex.UnwrapCompositionException(), nameof(WebViewControl));
			}
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
							var codeStreamService = _componentModel?.GetService<ICodeStreamService>();
							codeStreamService?.ChangeActiveEditorAsync(new Uri(_sessionService.LastActiveFileUrl));
						}
						catch (Exception ex) {
							Log.Warning(ex, nameof(WebViewControl_IsVisibleChanged));
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
				_languageServerReadyEvent = _eventAggregator.GetEvent<LanguageServerReadyEvent>()
					.ObserveOnApplicationDispatcher()
					.Subscribe(_ => {
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

							var router = new WebViewRouter(
								_componentModel.GetService<ICredentialsService>(),
								_componentModel.GetService<ISessionService>(),
								_componentModel.GetService<ICodeStreamAgentService>(),
								_componentModel.GetService<ISettingsServiceFactory>(),
								_eventAggregator,
								_browserService,
								_componentModel.GetService<IIdeService>(),
								_componentModel.GetService<IEditorService>(),
								_componentModel.GetService<IAuthenticationServiceFactory>());

							_browserService.AddWindowMessageEvent(
								async delegate (object sender, WindowEventArgs ea) { await router.HandleAsync(ea); });

							_browserService.LoadWebView();

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
				IsVisibleChanged -= WebViewControl_IsVisibleChanged;
			}

			_disposed = true;
		}
	}
}
