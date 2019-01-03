using CodeStream.VisualStudio.Models;
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
        Task OpenCommentByPostAsync(string streamId, string postId);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
        /// <summary>
        /// logs the user out from the CodeStream agent and the session
        /// </summary>
        /// <returns></returns>
        Task LogoutAsync();
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _agentService;
        private readonly IBrowserService _browserService;

        public CodeStreamService(ISessionService sessionService, ICodeStreamAgentService serviceProvider, IBrowserService browserService)
        {
            _sessionService = sessionService;
            _agentService = serviceProvider;
            _browserService = browserService;
        }

        public async Task ChangeActiveWindowAsync(string fileName, Uri uri)
        {
            if (!_sessionService.IsReady)
                return;

            var streamResponse = await _agentService.GetFileStreamAsync(uri);

            _browserService.PostMessage(new
            {
                type = "codestream:interaction:active-editor-changed",
                body = new
                {
                    editor = new
                    {
                        fileStreamId = streamResponse?.Stream?.Id,
                        uri = uri.ToString(),
                        fileName = fileName,
                        // in vscode, this came from the editor...
                        languageId = (string)null
                    }
                }
            });
        }

        public async Task OpenCommentByPostAsync(string streamId, string postId)
        {
            await Task.Yield();

            if (!_sessionService.IsReady)
                return;

            var postResponse = await _agentService.GetPostAsync(streamId, postId);
            if (postResponse?.Post != null)
            {
                _browserService.PostMessage(new
                {
                    type = "codestream:interaction:stream-thread-selected",
                    body = new
                    {
                        streamId = postResponse.Post.StreamId,
                        threadId = postResponse.Post.Id
                    }
                });
            }
        }

        public async Task OpenCommentByThreadAsync(string streamId, string threadId)
        {
            await Task.Yield();

            if (!_sessionService.IsReady)
                return;

            _browserService.PostMessage(new
            {
                type = "codestream:interaction:stream-thread-selected",
                body = new
                {
                    streamId = streamId,
                    threadId = threadId
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

            await _agentService.LogoutAsync();

            _sessionService.Logout();

            _browserService.LoadWebView();
        }
    }
}
