using System.Diagnostics;

namespace CodeStream.VisualStudio.LSP
{
    public interface ILanguageServerProcess
    {
        Process Create();
    }

    public class LanguageServerProcess : ILanguageServerProcess
    {
        /// <summary>
        /// Creates the lsp server process object
        /// </summary>
        /// <returns></returns>
        public Process Create()
        {
            var info = new ProcessStartInfo
            {
                FileName = @"C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
            };

            ////TODO package this up?                     
            //@"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.exe"
            var agent = @"..\..\..\..\..\..\codestream-lsp-agent\dist\agent-cli.js";
#if DEBUG
            info.Arguments = $@"{agent} --stdio --inspect=6009 --nolazy";
#else
            info.Arguments = $@"{agent} --stdio --nolazy";
#endif
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.UseShellExecute = false; 
            info.CreateNoWindow = true; 

            var process = new Process
            {
                StartInfo = info
            };           
            
            return process;
        }
    }
}
