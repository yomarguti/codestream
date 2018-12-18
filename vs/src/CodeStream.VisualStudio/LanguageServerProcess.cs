using System.Diagnostics;

namespace CodeStream.VisualStudio
{
    public interface ILanguageServerProcess
    {
        Process Create();
    }

    public class LanguageServerProcess : ILanguageServerProcess
    {
        /// <summary>
        /// Creates the lsp server process
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
            info.Arguments = $@"{agent} --stdio --inspect=6009 --nolazy";
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
