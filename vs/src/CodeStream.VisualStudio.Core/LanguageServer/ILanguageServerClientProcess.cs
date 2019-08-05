using CodeStream.VisualStudio.Core.Logging;

namespace CodeStream.VisualStudio.Core.LanguageServer {
	public interface ILanguageServerClientProcess {
		System.Diagnostics.Process Create(TraceLevel? traceLevel);
	}
}
