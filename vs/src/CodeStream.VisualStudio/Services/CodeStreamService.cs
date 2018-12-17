using System;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public class FileUri : Uri
    {
        public FileUri(string path) : base("file:///" + path.Replace("/", "\\"))
        {

        }
    }

    public interface SCodeStreamService
    {

    }

    public interface ICodeStreamService
    {
        Task<object> PostCodeAsync(FileUri uri, CancellationToken? cancellationToken);
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private ICodeStreamAgentService _agentService;
        private IBrowserService _browserService;

        public CodeStreamService(ICodeStreamAgentService serviceProvider, IBrowserService browserService)
        {
            _agentService = serviceProvider;
            _browserService = browserService;
        }

        public async Task<object> PostCodeAsync(FileUri uri, CancellationToken? cancellationToken = null)
        {
            var post = await _agentService.GetMetadataAsync(uri.ToString(), cancellationToken);

            _browserService.PostMessage(new
            {
                type = "codestream:interaction:code-highlighted",
                body = new
                {
                    code = post.Code,
                    fileUri = uri,
                    location = new int[] { 0, 1, 1, 5 }
                }
            });

            return new { };
        }
    }
}
