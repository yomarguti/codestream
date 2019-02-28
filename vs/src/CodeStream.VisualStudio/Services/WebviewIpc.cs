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
        void SendResponse(IAbstractMessageType message);
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

        public void SendResponse(IAbstractMessageType message)
        {
            using (Log.IsEnabled(LogEventLevel.Verbose) ? Log.TimeOperation($"{nameof(SendResponse)} Id={{Id}}", message.Id) : null)
            {
                BrowserService.PostMessage(message);
            }
        }
    }
}
