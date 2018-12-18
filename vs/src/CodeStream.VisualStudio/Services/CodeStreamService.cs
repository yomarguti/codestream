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
        Task<object> PostCodeAsync(FileUri uri, SelectedText selectedText, CancellationToken? cancellationToken);
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

        public async Task<object> PostCodeAsync(FileUri uri, SelectedText selectedText, CancellationToken? cancellationToken = null)
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
                    location = range.ToLocation()
                }
            });

            return new { };
        }
    }
}
