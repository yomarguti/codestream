using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService
    {

    }

    public interface ICodeStreamService
    {
        Task<object> PostCodeAsync(FileUri uri, SelectedText selectedText, CancellationToken? cancellationToken);
        Task OpenCommentAsync(string streamId, string threadId);
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {        
        private readonly ICodeStreamAgentService _agentService;
        private readonly IBrowserService _browserService;

        public CodeStreamService(ICodeStreamAgentService serviceProvider, IBrowserService browserService)
        {            
            _agentService = serviceProvider;
            _browserService = browserService;
        }


        public async Task OpenCommentAsync(string streamId, string threadId)
        {
            await Task.Yield();

            _browserService.PostMessage(new
            {
                type = "codestream:interaction:stream-thread-selected",
                body = new
                {
                    streamId,
                    threadId
                }
            });
        }

        public async Task<object> PostCodeAsync(FileUri uri,
            SelectedText selectedText,CancellationToken? cancellationToken = null)
        {
            var range = new Range(selectedText);

            var post = await _agentService.GetMetadataAsync(uri.ToString(), range, cancellationToken);

             _browserService.PostMessage(new
            {
                type = "codestream:interaction:code-highlighted",
                body = new
                {
                    code = post.Code,
                    fileUri = uri,
                    location = range.ToLocation(),
                    source = post?.Source,
                    gitError = post?.GitError,
                   // isHightlight = post?.IsHightlight
                }
            });

            return new { };
        }
    }
}
