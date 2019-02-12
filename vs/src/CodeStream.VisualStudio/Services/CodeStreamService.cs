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
        Task<object> PrepareCodeAsync(Uri uri, TextSelection textSelection, bool isDirty, bool isHighlight = false, CancellationToken? cancellationToken = null);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
        /// <summary>
        /// logs the user out from the CodeStream agent and the session
        /// </summary>
        /// <returns></returns>
        Task LogoutAsync();
        IBrowserService BrowserService { get; }
        Task TrackAsync(string eventName, TelemetryProperties properties = null);
    }

    [Injected]
    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamService>();

        private readonly Lazy<ICredentialsService> _credentialsService;
        private readonly Lazy<IEventAggregator> _eventAggregator;
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _agentService;
        public IBrowserService BrowserService { get; }

        private readonly Lazy<ISettingsService> _settingsService;
        private readonly Lazy<IToolWindowProvider> _toolWindowProvider;

        public CodeStreamService(
            Lazy<ICredentialsService> credentialsService,
            Lazy<IEventAggregator> eventAggregator,
            ISessionService sessionService,
            ICodeStreamAgentService serviceProvider,
            IBrowserService browserService,
            Lazy<ISettingsService> settingsService,
            Lazy<IToolWindowProvider> toolWindowProvider)
        {
            _credentialsService = credentialsService;
            _eventAggregator = eventAggregator;
            _sessionService = sessionService;
            _agentService = serviceProvider;
            BrowserService = browserService;
            _settingsService = settingsService;
            _toolWindowProvider = toolWindowProvider;
        }

        public async Task ChangeActiveWindowAsync(string fileName, Uri uri)
        {
            if (!_sessionService.IsReady) return;

            try
            {
                var streamResponse = await _agentService.GetFileStreamAsync(uri);

                BrowserService.PostMessage(new DidChangeActiveEditorNotification
                {
                    Type = "codestream:interaction:active-editor-changed",
                    Body = new DidChangeActiveEditorNotificationBody
                    {
                        Editor = new DidChangeActiveEditorNotificationBodyEditor
                        {
                            FileStreamId = streamResponse?.Stream?.Id,
                            Uri = uri.ToString(),
                            FileName = fileName,
                            // in vscode, this came from the editor...
                            LanguageId = null
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
            if (!_sessionService.IsReady) return Task.CompletedTask;

            try
            {
                BrowserService.PostMessage(new DidChangeStreamThreadNotification
                {
                    Type = "codestream:interaction:stream-thread-selected",
                    Body = new DidChangeStreamThreadNotificationBody
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

        public async Task<object> PrepareCodeAsync(Uri uri, TextSelection textSelection, bool isDirty, bool isHighlight = false,
            CancellationToken? cancellationToken = null)
        {
            if (!_sessionService.IsReady) return Task.CompletedTask;

            try
            {
                // switch to main thread to show the ToolWindow
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken ?? CancellationToken.None);
                _toolWindowProvider.Value?.ShowToolWindow(Guids.WebViewToolWindowGuid);

                var response = await _agentService.PrepareCodeAsync(uri, textSelection.Range, isDirty, cancellationToken);

                var source = response?.Source;
                BrowserService.PostMessage(new DidSelectCodeNotification
                {
                    Type = "codestream:interaction:code-highlighted",
                    Body = new DidSelectCodeNotificationBody
                    {
                        Code = response?.Code,
                        File = source?.File,
                        FileUri = uri.ToString(),
                        Range = response?.Range,
                        Source = source,
                        GitError = response?.GitError,
                        IsHighlight = isHighlight
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
            if (_sessionService.IsReady)
            {
                _agentService.TrackAsync(eventName, properties);
            }

            await Task.CompletedTask;
        }

        public async Task LogoutAsync()
        {
            if (!_sessionService.IsReady) return;

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

            BrowserService.LoadWebView();
        }
    }
}
