using System.Diagnostics;

namespace CodeStream.VisualStudio.Process
{
    public class ProcessFactory
    {
        /// <summary>
        /// Create a process
        /// </summary>
        /// <param name="fileName"></param>
        /// <param name="arguments"></param>
        /// <returns></returns>
        public static System.Diagnostics.Process Create(string fileName, string arguments)
        {
            var info = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            return new System.Diagnostics.Process()
            {
                StartInfo = info
            };

        }
    }
}
