using CodeStream.VisualStudio.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService
    {

    }

    public interface ICodeStreamService
    {
        void SetAgentReady();
        void ChangeActiveWindow(string fileName, Uri uri);
        Task<object> PostCodeAsync(FileUri uri, SelectedText selectedText, bool? isHighlight = null, CancellationToken? cancellationToken = null);
        Task OpenCommentByPostAsync(string streamId, string postId);
        Task OpenCommentByThreadAsync(string streamId, string threadId);
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private readonly ICodeStreamAgentService _agentService;
        private readonly IBrowserService _browserService;
        private SessionState _sessionState;
        public CodeStreamService(ICodeStreamAgentService serviceProvider, IBrowserService browserService)
        {
            _agentService = serviceProvider;
            _browserService = browserService;
        }

        public void SetAgentReady()
        {
            _sessionState = SessionState.AgentReady;
        }

        public void ChangeActiveWindow(string fileName, Uri uri)
        {
            if (_sessionState != SessionState.AgentReady) return;

            _browserService.PostMessage(new
            {
                type = "codestream:interaction:active-editor-changed",
                body = new
                {
                    editor = new
                    {
                        fileStreamId = (string)null,
                        uri = uri.ToString(),
                        fileName = fileName,
                        languageId = (string)null
                    }
                }
            });
        }

        public async Task OpenCommentByPostAsync(string streamId, string postId)
        {
            await Task.Yield();

            if (_sessionState != SessionState.AgentReady) return;

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

        public async Task<object> PostCodeAsync(FileUri uri, SelectedText selectedText, bool? isHighlight = null,
            CancellationToken? cancellationToken = null)
        {
            var range = new Range(selectedText);

            var post = await _agentService.PrepareCodeAsync(uri.ToString(), range, cancellationToken);

            var source = post?.Source;
            _browserService.PostMessage(new
            {
                type = "codestream:interaction:code-highlighted",
                body = new
                {
                    code = post?.Code,
                    file = source?.File,
                    fileUri = uri,
                    location = range.ToLocation(),
                    source = source,
                    gitError = post?.GitError,
                    isHightlight = isHighlight
                }
            });

            return new { };
        }
    }
}
