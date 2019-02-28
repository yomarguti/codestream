using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.Services
{
    public static class WebviewIpcExtensions
    {
        /// <summary>
        /// Creates a scope, that if not completed, sends a generic response message
        /// </summary>
        /// <param name="ipc"></param>
        /// <param name="message"></param>
        /// <returns></returns>
        public static WebviewIpcScope CreateScope(this IWebviewIpc ipc, WebviewIpcMessage message) => WebviewIpcScope.Create(ipc, message);
    }
}