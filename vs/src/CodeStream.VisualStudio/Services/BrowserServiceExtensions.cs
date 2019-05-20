using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.Services
{
    public static class BrowserServiceExtensions
    {
        /// <summary>
        /// Creates a scope, that if not completed, sends a generic response message
        /// </summary>
        /// <param name="ipc"></param>
        /// <param name="message"></param>
        /// <returns></returns>
        public static IpcScope CreateScope(this IBrowserService ipc, WebviewIpcMessage message) => IpcScope.Create(ipc, message);
    }
}
