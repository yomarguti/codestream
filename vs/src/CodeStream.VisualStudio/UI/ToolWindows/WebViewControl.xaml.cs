using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Reactive.Linq;
using System.Windows.Controls;

namespace CodeStream.VisualStudio.UI.ToolWindows
{
    // ReSharper disable once RedundantExtendsListEntry
    // ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
    public partial class WebViewControl : UserControl, IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewControl>();

        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browserService;
        private readonly ISessionService _sessionService;
        private IDisposable _languageServerDisconnectedEvent;
        private IDisposable _languageServerReadyEvent;

        private List<IDisposable> _disposables;

        bool _disposed = false;
        private bool _isInitialized;
        private static readonly object InitializeLock = new object();

        /// <summary>
        /// Initializes a new instance of the <see cref="WebViewControl"/> class.
        /// </summary>
        public WebViewControl()
        {
            InitializeComponent();

            Log.Verbose($"{nameof(OnInitialized)}...");

            _browserService = Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;

            if (_browserService != null)
            {
                _browserService.Initialize();
                _browserService.AttachControl(Grid);
                _browserService.LoadSplashView();

                _eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
                _sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                if (_sessionService == null)
                {
                    Log.Warning("SessionService is null");
                }
                else
                {
                    _languageServerDisconnectedEvent = _eventAggregator?.GetEvent<LanguageServerDisconnectedEvent>().Subscribe(_ =>
                    {
                        _isInitialized = false;

                        _browserService.LoadSplashView();

                        SetupInitialization();
                    });

                   SetupInitialization();
                }
            }
            else
            {
                Log.Warning("BrowserService is null");
            }

            Log.Verbose($"{nameof(OnInitialized)}");
        }

        private void SetupInitialization()
        {
            if (_sessionService.IsAgentReady)
            {
                InitializeCore();
            }
            else
            {
                if (_languageServerReadyEvent != null)
                {
                    // if we're re-using this... dispose it first.
                    _languageServerReadyEvent.Dispose();
                }
                // ReSharper disable once PossibleNullReferenceException
                _languageServerReadyEvent = _eventAggregator.GetEvent<LanguageServerReadyEvent>().Subscribe(_ =>
                {
                    InitializeCore();
                });
            }
        }

        private void InitializeCore()
        {
            lock (InitializeLock)
            {
                if (!_isInitialized)
                {
                    var router = new WebViewRouter(
                        new Lazy<ICredentialsService>(() =>
                            Package.GetGlobalService(typeof(SCredentialsService)) as ICredentialsService),
                        Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
                        Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                        Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService,
                        _eventAggregator,
                        _browserService,
                        Package.GetGlobalService(typeof(SIdeService)) as IIdeService);

                    _browserService.AddWindowMessageEvent(async delegate(object sender, WindowEventArgs ea)
                    {
                        await router.HandleAsync(ea);
                    });

                    _browserService.LoadWebView();

                    var throttle = TimeSpan.FromMilliseconds(50);
                    _disposables = new List<IDisposable>
                    {
                        _eventAggregator.GetEvent<CodemarksChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<PostsChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<PreferencesChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ =>
                            {
                                _browserService.PostMessage(new WebviewIpcMessage("codestream:data:preferences")
                                {
                                    Body = _.Data
                                });
                            }),
                        _eventAggregator.GetEvent<RepositoriesChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<StreamsChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<TeamsChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<UnreadsChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ =>
                            {
                                _browserService.PostMessage(new WebviewIpcMessage("codestream:data:unreads")
                                {
                                    Body = _.Data
                                });
                            }),
                        _eventAggregator.GetEvent<UsersChangedChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ => { OnSessionDataChanged(_.Type, _.Data); }),
                        _eventAggregator.GetEvent<ConnectionStatusChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ =>
                            {
                                switch (_.Status)
                                {
                                    case ConnectionStatus.Disconnected:
                                        // TODO: Handle this
                                        break;
                                    case ConnectionStatus.Reconnecting:
                                        OnDidDisconnect();
                                        break;
                                    case ConnectionStatus.Reconnected:
                                        if (_.Reset == true)
                                        {
                                            _browserService.ReloadWebView();
                                            return;
                                        }

                                        OnDidConnect();
                                        break;
                                }
                            }),

                        _eventAggregator.GetEvent<AuthenticationChangedEvent>()
                            .Throttle(throttle)
                            .Subscribe(_ =>
                            {
                                if (_.Reason == LogoutReason.Token)
                                {
                                    var codeStreamService =
                                        Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
                                    if (codeStreamService != null)
                                    {
                                        ThreadHelper.JoinableTaskFactory.Run(async delegate
                                        {
                                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                                            await codeStreamService.LogoutAsync();
                                        });
                                    }
                                }
                                else
                                {
                                    // TODO: Handle this
                                }
                            })
                    };

                    _isInitialized = true;
                }
            }
        }

        private void OnDidDisconnect()
        {
            _browserService.PostMessage(new
            {
                type = "codestream:connectivity:offline",
                body = new { }
            });
        }

        private void OnDidConnect()
        {
            _browserService.PostMessage(new
            {
                type = "codestream:connectivity:online",
                body = new { }
            });
        }

        private void OnSessionDataChanged(string type, object data)
        {
            _browserService.PostMessage(new WebviewIpcMessage("codestream:data")
            {
                Body = new WebviewIpcMessageBody
                {
                    Type = type,
                    Payload = data
                }
            });
        }
        
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
        
        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
                return;

            if (disposing)
            {
                _languageServerReadyEvent?.Dispose();
                _languageServerDisconnectedEvent?.Dispose();
                _disposables.Dispose();
            }

            _disposed = true;
        }
    }
}