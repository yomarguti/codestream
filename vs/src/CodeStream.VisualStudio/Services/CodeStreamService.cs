using Microsoft.VisualStudio.Threading;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamService
    {

    }

    public interface ICodeStreamService
    {
        Task<object> PostCodeAsync(string uri, CancellationToken? cancellationToken);
    }

    public class CodeStreamService : ICodeStreamService, SCodeStreamService
    {
        private ICodeStreamAgentService _serviceProvider;
        private IBrowserService _browserService;
        public CodeStreamService(ICodeStreamAgentService serviceProvider, IBrowserService browserService)
        {
            _serviceProvider = serviceProvider;
            _browserService = browserService;
        }

        public async Task<object> PostCodeAsync(string uri, CancellationToken? cancellationToken = null)
        {       
            var post = await _serviceProvider.GetMetadataAsync(uri, cancellationToken);            
            _browserService.PostMessage(new
            {
                type = "codestream:interaction:code-highlighted",
                body = new
                {
                    code = post.Code,
                    fileUri = uri,
                    range = new int[] { 0, 1, 1, 5 }
                }
            });

            return new { };
        }
    }
}
