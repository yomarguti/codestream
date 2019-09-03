using Microsoft.VisualStudio.LanguageServer.Client;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Shell._2019.LanguageServer {
	public interface ICodestreamLanguageClient : ILanguageClient {
		Task RestartAsync();
		Task TryStopAsync();
	}
}
