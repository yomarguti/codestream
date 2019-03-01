using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Serilog;
using Serilog.Events;
using SerilogTimings.Extensions;

namespace CodeStream.VisualStudio.Services
{
    public interface SWebviewIpc { }

    public interface IWebviewIpc
    {
        void Send(IAbstractMessageType message);
        void Notify(INotificationType message);
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
            using (Log.IsEnabled(LogEventLevel.Verbose) ? Log.TimeOperation($"{nameof(SendResponse)} Id={{Id}}", message.Id) : null)
            {
                BrowserService.PostMessage(message);
            }
        }

        public void Send(IAbstractMessageType message) => SendInternal(message);

        public void SendResponse(IRequestType message) =>  SendInternal(message);

        public void Notify(INotificationType message) => SendInternal(message);
    }
}
