using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Core.LanguageServer {
	public interface ILanguageServerClientManager {
		Task RestartAsync();
	}
}
