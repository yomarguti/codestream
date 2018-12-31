using CodeStream.VisualStudio.Extensions;
using System;
using System.Windows.Controls;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services
{
    public class WindowEventArgs
    {
        public WindowEventArgs(string message)
        {
            Message = message;
        }

        public string Message { get; }
    }

    public interface SBrowserService
    {

    }

    public interface IBrowserService : IDisposable
    {
        void PostMessage(string message);
        void PostMessage(object message);
        void LoadHtml(string html);
        void AddWindowMessageEvent(WindowMessageHandler handler);
        void AttachControl(Grid grid);
        string FooterHtml { get; }
    }

    public delegate Task WindowMessageHandler(object sender, WindowEventArgs e);

    public abstract class BrowserServiceBase : IBrowserService, SBrowserService
    {
        public virtual string FooterHtml { get; } = "";

        public abstract void Dispose();

        public abstract void AddWindowMessageEvent(WindowMessageHandler handler);

        public abstract void AttachControl(Grid grid);

        public virtual void LoadHtml(string html) { }

        public virtual void PostMessage(string message) { }

        public virtual void PostMessage(object message)
        {
            PostMessage(message.ToJson());
        }
    }

    public class NullBrowserService : BrowserServiceBase
    {
        private readonly IAsyncServiceProvider _serviceProvider;
        public NullBrowserService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public override void Dispose()
        {

        }

        public override void AddWindowMessageEvent(WindowMessageHandler handler)
        {

        }

        public override void AttachControl(Grid grid)
        {

        }
    }
}