using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Serilog;
using System;
using System.Threading;
using System.Threading.Tasks;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService { }

    public interface ICodeStreamService
    {
        Task ChangeActiveWindowAsync(string fileName, Uri uri);
        Task<object> PostCodeAsync(Uri uri, SelectedText selectedText, bool isDirty, bool? isHighlight = null, CancellationToken? cancellationToken = null);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
        /// <summary>
        /// logs the user out from the CodeStream agent and the session
        /// </summary>
        /// <returns></returns>
        Task LogoutAsync();
        IBrowserService BrowserService { get; }
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
            if (!_sessionService.IsReady)
                return;

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

        public Task OpenCommentByThreadAsync(string streamId, string threadId)
        {
            if (!_sessionService.IsReady) return Task.CompletedTask;

            BrowserService.PostMessage(new DidChangeStreamThreadNotification
            {
                Type = "codestream:interaction:stream-thread-selected",
                Body = new DidChangeStreamThreadNotificationBody
                {
                    StreamId = streamId,
                    ThreadId = threadId
                }
            });

            return Task.CompletedTask;
        }

        public async Task<object> PostCodeAsync(Uri uri, SelectedText selectedText, bool isDirty, bool? isHighlight = null,
            CancellationToken? cancellationToken = null)
        {
            if (!_sessionService.IsReady) return Task.CompletedTask;

            // switch to main thread to show the ToolWindow
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken ?? CancellationToken.None);
            _toolWindowProvider.Value?.ShowToolWindow(Guids.WebViewToolWindowGuid);

            var range = new Range(selectedText);

            var post = await _agentService.PrepareCodeAsync(uri, range, isDirty, cancellationToken);

            var source = post?.Source;
            BrowserService.PostMessage(new DidSelectCodeNotification
            {
                Type = "codestream:interaction:code-highlighted",
                Body = new DidSelectCodeNotificationBody
                {
                    Code = post?.Code,
                    File = source?.File,
                    FileUri = uri.ToString(),
                    Location = range.ToLocation(),
                    Source = source,
                    GitError = post?.GitError,
                    IsHightlight = isHighlight
                }
            });

            return new { };
        }

        public async Task LogoutAsync()
        {
            if (!_sessionService.IsReady)
                return;

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
