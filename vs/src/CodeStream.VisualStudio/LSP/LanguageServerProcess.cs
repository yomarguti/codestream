using CodeStream.VisualStudio.Process;
using System.IO;
using System.Reflection;
using CodeStream.VisualStudio.Core.Logging;

namespace CodeStream.VisualStudio.LSP
{
    public interface ILanguageServerProcess
    {
        System.Diagnostics.Process Create(TraceLevel traceLevel);
    }

    public class LanguageServerProcess : ILanguageServerProcess
    {
        /// <summary>
        /// Creates the lsp server process object
        /// </summary>
        /// <returns></returns>
        public System.Diagnostics.Process Create(TraceLevel traceLevel)
        {
            var assembly = Assembly.GetAssembly(typeof(LanguageServerProcess));
            string arguments = null;
            var exe = @"node.exe";
            var logPath = $"{Application.LogPath}vs-agent.log";
#if DEBUG
            var path = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.js";
            arguments = $@"--nolazy --inspect=6009 ""{path}"" --stdio --log={logPath}";
#else
            exe = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.exe";
            arguments = $@"--stdio --nolazy";
            if (traceLevel == TraceLevel.Verbose)
            {
                arguments += $" --log={logPath}";
            }
#endif
            return ProcessFactory.Create(exe, arguments);
        }
    }
}
