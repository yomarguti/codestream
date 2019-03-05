using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService { }

    public interface ICodeStreamService
    {
        Task ChangeActiveWindowAsync(string fileName, Uri uri);
        Task<object> PrepareCodeAsync(Uri uri, TextSelection textSelection, string codemarkType, bool isDirty, bool isHighlight = false, CancellationToken? cancellationToken = null);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
        /// <summary>
        /// logs the user out from the CodeStream agent and the session
        /// </summary>
        /// <returns></returns>
        Task LogoutAsync();
        IWebviewIpc WebviewIpc { get; }
        Task TrackAsync(string eventName, TelemetryProperties properties = null);
        bool IsReady { get; }
    }

    [Injected]
    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamService>();

        private readonly Lazy<ICredentialsService> _credentialsService;
        private readonly Lazy<IEventAggregator> _eventAggregator;
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _agentService;
        public IWebviewIpc WebviewIpc { get; }

        private readonly Lazy<ISettingsService> _settingsService;
        private readonly Lazy<IToolWindowProvider> _toolWindowProvider;

        public CodeStreamService(
            Lazy<ICredentialsService> credentialsService,
            Lazy<IEventAggregator> eventAggregator,
            ISessionService sessionService,
            ICodeStreamAgentService serviceProvider,
            IWebviewIpc ipc,
            Lazy<ISettingsService> settingsService,
            Lazy<IToolWindowProvider> toolWindowProvider)
        {
            _credentialsService = credentialsService;
            _eventAggregator = eventAggregator;
            _sessionService = sessionService;
            _agentService = serviceProvider;
            WebviewIpc = ipc;
            _settingsService = settingsService;
            _toolWindowProvider = toolWindowProvider;
        }

        public bool IsReady
        {
            get { return _sessionService?.IsReady == true; }
        }

        public async Task ChangeActiveWindowAsync(string fileName, Uri uri)
        {
            if (!IsReady) return;

            try
            {
                var streamResponse = await _agentService.GetFileStreamAsync(uri);

                WebviewIpc.Notify(new DidChangeActiveEditorNotificationType
                {
                    Params = new DidChangeActiveEditorNotificationParams
                    {
                        Editor = new DidChangeActiveEditorNotificationTypeParamsEditor
                        {
                            FileStreamId = streamResponse?.Stream?.Id,
                            Uri = uri.ToString(),
                            FileName = fileName,
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(ChangeActiveWindowAsync)} FileName={fileName} Uri={uri}");
            }
        }

        public Task OpenCommentByThreadAsync(string streamId, string threadId)
        {
            if (!IsReady) return Task.CompletedTask;

            try
            {
                WebviewIpc.Notify(new DidSelectStreamThreadNotificationType
                {
                    Params = new DidSelectStreamThreadNotificationTypeParams
                    {
                        StreamId = streamId,
                        ThreadId = threadId
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(OpenCommentByThreadAsync)} StreamId={streamId} ThreadId={threadId}");
            }

            return Task.CompletedTask;
        }

        public async Task<object> PrepareCodeAsync(Uri uri, TextSelection textSelection, string codemarkType, bool isDirty,  bool isHighlight = false,
            CancellationToken? cancellationToken = null)
        {
            if (!IsReady) return Task.CompletedTask;

            try
            {
                // switch to main thread to show the ToolWindow
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken ?? CancellationToken.None);
                _toolWindowProvider.Value?.ShowToolWindow(Guids.WebViewToolWindowGuid);

                var response = await _agentService.PrepareCodeAsync(uri, textSelection.Range, isDirty, cancellationToken);

                var source = response?.Source;
                WebviewIpc.Notify(new HostDidSelectCodeNotificationType
                {
                    Params = new HostDidSelectCodeNotification
                    {
                        Code = response?.Code,
                        File = source?.File,
                        FileUri = uri.ToString(),
                        Range = response?.Range,
                        Source = source,
                        GitError = response?.GitError,
                        IsHighlight = isHighlight,
                        Type = codemarkType.ToLowerInvariant()
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(PrepareCodeAsync)} Uri={uri}");
            }

            return new { };
        }

        public async Task TrackAsync(string eventName, TelemetryProperties properties = null)
        {
            if (IsReady)
            {
                _agentService.TrackAsync(eventName, properties);
            }

            await Task.CompletedTask;
        }

        public async Task LogoutAsync()
        {
            if (!IsReady) return;

            try
            {
                await _credentialsService.Value.DeleteAsync(new Uri(_settingsService.Value.ServerUrl), _settingsService.Value.Email);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, $"{nameof(LogoutAsync)} - credentials");
            }

            try
            {
                await _agentService.LogoutAsync();
            }
            catch (Exception ex)
            {
                Log.Warning(ex, $"{nameof(LogoutAsync)} - agent");
            }

            try
            {
                _sessionService.Logout();
            }
            catch (Exception ex)
            {
                Log.Warning(ex, $"{nameof(LogoutAsync)} - session");
            }

            _eventAggregator.Value.Publish(new SessionLogoutEvent());

            WebviewIpc.BrowserService.LoadWebView();
        }
    }
}
