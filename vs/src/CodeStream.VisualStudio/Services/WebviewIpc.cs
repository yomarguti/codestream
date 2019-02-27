using System;
using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.Services
{
    public interface SWebviewIpc
    {

    }

    public interface IWebviewIpc
    {
        void SendResponse(IAbstractMessageType message);
        void SendResponse(string message);
        void LoadWebView();
        void ReloadWebView();

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

        public void SendResponse(string message)
        {
            BrowserService.PostMessage(message);
        }

        public void LoadWebView()
        {
            BrowserService.LoadWebView();
        }

        public void ReloadWebView()
        {
            BrowserService.ReloadWebView();
        }
    }
}
