using CodeStream.VisualStudio.Process;

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
            string arguments = "";

            ////TODO package this up?                     
            //@"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.exe"
            var agent = @"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.js";
#if DEBUG
            arguments = $@"{agent} --stdio --inspect=6009 --nolazy";
#else
            arguments = $@"{agent} --stdio --nolazy";
#endif
            
            return ProcessFactory.Create(
                @"C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe",
                arguments);
        }
    }
}
