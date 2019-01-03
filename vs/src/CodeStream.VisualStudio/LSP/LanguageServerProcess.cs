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
            var path = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent-cli.js";
            var arguments = $@"""{path}"" --stdio --inspect=6009 --nolazy";
            return ProcessFactory.Create(@"C:\Program Files\NodeJs\node.exe", arguments);
#else
            var exe = Path.GetDirectoryName(assembly.Location) + @"\LSP\agent-cli.exe";
            var arguments = $@"--stdio --nolazy";
            return ProcessFactory.Create(exe, arguments);
#endif
        }
    }
}
