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
            string exe = @"node.exe";
#if DEBUG
            var path = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.js";
            arguments = $@"""{path}"" --stdio --inspect=6009 --nolazy --log={Application.LogPath}agent.log";
#else
            exe = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.exe";
            arguments = $@"--stdio --nolazy";
            if (traceLevel == TraceLevel.Verbose)
            {
                arguments += $" --log={Application.LogPath}agent.log";
            }
#endif
            return ProcessFactory.Create(exe, arguments);
        }
    }
}
