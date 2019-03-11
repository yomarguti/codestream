using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.UI;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService { }

    public interface ICodeStreamService
    {
        Task ChangeActiveWindowAsync(string fileName, Uri uri);
        Task NewCodemarkAsync(Uri uri,
            EditorState editorState,
            CodemarkType codemarkType,
            bool ensureInView = true,
            CancellationToken? cancellationToken = null);
        Task EditorSelectionChangedNotificationAsync(Uri uri,
            EditorState editorState,
            List<Range> visibleRanges,
            CodemarkType codemarkType,
            CancellationToken? cancellationToken = null);
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
        private readonly Lazy<IIdeService> _ideService;
        private readonly Lazy<IToolWindowProvider> _toolWindowProvider;

        public CodeStreamService(
            Lazy<ICredentialsService> credentialsService,
            Lazy<IEventAggregator> eventAggregator,
            ISessionService sessionService,
            ICodeStreamAgentService serviceProvider,
            IWebviewIpc ipc,
            Lazy<ISettingsService> settingsService,
            Lazy<IIdeService> ideService,
            Lazy<IToolWindowProvider> toolWindowProvider)
        {
            _credentialsService = credentialsService;
            _eventAggregator = eventAggregator;
            _sessionService = sessionService;
            _agentService = serviceProvider;
            WebviewIpc = ipc;
            _settingsService = settingsService;
            _ideService = ideService;
            _toolWindowProvider = toolWindowProvider;
        }

        public bool IsReady
        {
            get { return _sessionService?.IsReady == true; }
        }

        public Task ChangeActiveWindowAsync(string fileName, Uri uri)
        {
            if (!IsReady) return Task.CompletedTask;

            try
            {
                var activeTextView = _ideService.Value.GetActiveTextView();
                var editorState = _ideService.Value.GetActiveEditorState();

                WebviewIpc.Notify(new HostDidChangeActiveEditorNotificationType
                {
                    Params = new HostDidChangeActiveEditorNotification
                    {
                        Editor = new HostDidChangeActiveEditorNotificationEditor(fileName,
                        uri,
                        editorState.ToEditorSelections(),
                        activeTextView?.TextView.ToVisibleRanges())
                        {
                            Metrics = ThemeManager.CreateEditorMetrics(activeTextView?.TextView),
                            LanguageId = null
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(ChangeActiveWindowAsync)} FileName={fileName} Uri={uri}");
            }
            return Task.CompletedTask;
        }

        public Task OpenCommentByThreadAsync(string streamId, string threadId)
        {
            if (!IsReady) return Task.CompletedTask;

            try
            {
                WebviewIpc.Notify(new ShowStreamNotificationType
                {
                    Params = new ShowStreamNotification
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

        public Task EditorSelectionChangedNotificationAsync(Uri uri, EditorState editorState,
            List<Range> visibleRanges, CodemarkType codemarkType, CancellationToken? cancellationToken = null)
        {
            if (!IsReady) return Task.CompletedTask;

            try
            {
                WebviewIpc.Notify(new HostDidChangeEditorSelectionNotificationType
                {
                    Params = new HostDidChangeEditorSelectionNotification(uri, editorState.ToEditorSelections(), visibleRanges)
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"{nameof(EditorSelectionChangedNotificationAsync)} Uri={uri}");
            }

            return Task.CompletedTask;
        }

        public async Task NewCodemarkAsync(Uri uri, EditorState textSelection, CodemarkType codemarkType, bool ensureInView = true, CancellationToken? cancellationToken = null)
        {
            if (IsReady)
            {
                try
                {
                    if (ensureInView)
                    {
                        // switch to main thread to show the ToolWindow
                        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken ?? CancellationToken.None);
                        _toolWindowProvider.Value?.ShowToolWindow(Guids.WebViewToolWindowGuid);
                    }

                    WebviewIpc.Notify(new NewCodemarkNotificationType
                    {
                        Params = new NewCodemarkNotification(uri, textSelection?.Range, codemarkType)
                    });
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"{nameof(NewCodemarkAsync)} Uri={uri}");
                }
            }

            await Task.CompletedTask;
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

            WebviewIpc.Notify(new HostDidLogoutNotificationType());

            WebviewIpc.BrowserService.LoadWebView();
        }
    }
}
