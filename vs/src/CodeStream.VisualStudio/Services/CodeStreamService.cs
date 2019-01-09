using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Serilog;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService { }

    public interface ICodeStreamService
    {
        Task ChangeActiveWindowAsync(string fileName, Uri uri);
        Task<object> PostCodeAsync(Uri uri, SelectedText selectedText, bool? isHighlight = null, CancellationToken? cancellationToken = null);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
        /// <summary>
        /// logs the user out from the CodeStream agent and the session
        /// </summary>
        /// <returns></returns>
        Task LogoutAsync();
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamService>();

        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _agentService;
        private readonly IBrowserService _browserService;
        private readonly Lazy<ISettingsService> _settingsService;

        public CodeStreamService(
            ISessionService sessionService,
            ICodeStreamAgentService serviceProvider,
            IBrowserService browserService,
            Lazy<ISettingsService> settingsService)
        {
            _sessionService = sessionService;
            _agentService = serviceProvider;
            _browserService = browserService;
            _settingsService = settingsService;
        }

        public async Task ChangeActiveWindowAsync(string fileName, Uri uri)
        {
            if (!_sessionService.IsReady)
                return;

            var streamResponse = await _agentService.GetFileStreamAsync(uri);

            _browserService.PostMessage(new DidChangeActiveEditorNotification
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

        public async Task OpenCommentByThreadAsync(string streamId, string threadId)
        {
            await Task.Yield();

            if (!_sessionService.IsReady)
                return;

            _browserService.PostMessage(new DidChangeStreamThreadNotification
            {
                Type = "codestream:interaction:stream-thread-selected",
                Body = new DidChangeStreamThreadNotificationBody
                {
                    StreamId = streamId,
                    ThreadId = threadId
                }
            });
        }

        public async Task<object> PostCodeAsync(Uri uri, SelectedText selectedText, bool? isHighlight = null,
            CancellationToken? cancellationToken = null)
        {
            if (!_sessionService.IsReady)
                return Task.CompletedTask;

            var range = new Range(selectedText);

            var post = await _agentService.PrepareCodeAsync(uri.ToString(), range, cancellationToken);

            var source = post?.Source;
            _browserService.PostMessage(new DidSelectCodeNotification
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
                await new CredentialsService()
                    .DeleteAsync(new Uri(_settingsService.Value.ServerUrl), _settingsService.Value.Email);
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

            _browserService.LoadWebView();
        }
    }
}
