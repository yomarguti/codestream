using CodeStream.VisualStudio.Models;

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
        public WebviewIpc(IBrowserService browserService)
        {
            BrowserService = browserService;
        }

        public IBrowserService BrowserService { get; }

        public void SendResponse(IAbstractMessageType message)
        {
            BrowserService.PostMessage(message);
        }
    }
}
