using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Serilog;
using Serilog.Events;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SWebviewIpc
    {
    }

    public interface IWebviewIpc
    {
        void Send(IAbstractMessageType message);
        void Notify(INotificationType message);
        Task NotifyInBackground(INotificationType message);
        void SendResponse(IRequestType message);
        IBrowserService BrowserService { get; }
    }

    public class WebviewIpc : IWebviewIpc, SWebviewIpc
    {
        private static readonly ILogger Log = LogManager.ForContext<WebviewIpc>();

        public WebviewIpc(IBrowserService browserService)
        {
            BrowserService = browserService;
        }

        public IBrowserService BrowserService { get; }

        private void SendInternal(IAbstractMessageType message)
        {
            using (IpcLogger.CriticalOperation(Log, "RES", message))
            {
                BrowserService.PostMessage(message);
            }
        }

        public void Send(IAbstractMessageType message) => SendInternal(message);

        public void SendResponse(IRequestType message) => SendInternal(message);

        public void Notify(INotificationType message) => SendInternal(message);

        /// <summary>
        /// Sends the notification on a background thread
        /// </summary>
        /// <param name="message"></param>
        /// <returns></returns>
        public Task NotifyInBackground(INotificationType message)
        {
            return Task.Factory.StartNew(() =>
            {
                SendInternal(message);
            });
        }
    }
}


