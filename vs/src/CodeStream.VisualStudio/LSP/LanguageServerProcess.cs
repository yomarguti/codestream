using CodeStream.VisualStudio.Process;
using System.IO;
using System.Reflection;

namespace CodeStream.VisualStudio.LSP
{
    public interface ILanguageServerProcess
    {
        System.Diagnostics.Process Create();
    }

    public class LanguageServerProcess : ILanguageServerProcess
    {
        /// <summary>
        /// Creates the lsp server process object
        /// </summary>
        /// <returns></returns>
        public System.Diagnostics.Process Create()
        {
            var assembly = Assembly.GetAssembly(typeof(LanguageServerProcess));

#if DEBUG
            var path = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.js";
            var arguments = $@"""{path}"" --stdio --inspect=6009 --nolazy --log={Application.LogPath}agent.log";
            return ProcessFactory.Create(@"node.exe", arguments);
#else
            var exe = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent.exe";
            var arguments = $@"--stdio --nolazy --log={Application.LogPath}agent.log";
            return ProcessFactory.Create(exe, arguments);
#endif
        }
    }
}
