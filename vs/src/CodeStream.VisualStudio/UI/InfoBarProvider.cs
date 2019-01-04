using Microsoft;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;

namespace CodeStream.VisualStudio.UI
{
    public class InfoBarProvider : IVsInfoBarUIEvents
    {
        private readonly IServiceProvider _serviceProvider;
        private uint _cookie;

        private InfoBarProvider(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public static InfoBarProvider Instance { get; private set; }

        public static void Initialize(IServiceProvider serviceProvider)
        {
            Instance = new InfoBarProvider(serviceProvider);
        }

        public void OnClosed(IVsInfoBarUIElement infoBarUiElement)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            infoBarUiElement.Unadvise(_cookie);
        }

        public void OnActionItemClicked(IVsInfoBarUIElement infoBarUiElement, IVsInfoBarActionItem actionItem)
        {
            //string context = (string)actionItem.ActionContext;

            //if (context == "yes")
            //{
            //   // MessageBox.Show("You clicked Yes!");
            //}
            //else
            //{
            //  //  MessageBox.Show("You clicked No!");
            //}
        }

        public void ShowInfoBar(string message)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var shell = _serviceProvider.GetService(typeof(SVsShell)) as IVsShell;
            if (shell == null) return;

            shell.GetProperty((int)__VSSPROPID7.VSSPROPID_MainWindowInfoBarHost, out var obj);
            var host = (IVsInfoBarHost)obj;

            if (host == null) return;

            var infoBarModel = new InfoBarModel(message, isCloseButtonVisible: true);

            var factory = _serviceProvider.GetService(typeof(SVsInfoBarUIFactory)) as IVsInfoBarUIFactory;
            Assumes.Present(factory);

            IVsInfoBarUIElement element = factory.CreateInfoBar(infoBarModel);
            element.Advise(this, out _cookie);
            host.AddInfoBar(element);
        }
    }
}
