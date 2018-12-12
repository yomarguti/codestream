using System.Diagnostics;

namespace CodeStream.VisualStudio.Services
{
    public class BrowserService : SBrowserService, IBrowserService
    {
        private Microsoft.VisualStudio.OLE.Interop.IServiceProvider serviceProvider;


        public BrowserService(Microsoft.VisualStudio.OLE.Interop.IServiceProvider sp)
        {
            serviceProvider = sp;
        }

        public void Navigate(string url)
        {
            Process.Start(url);
        }
    }

    public interface SBrowserService
    {
    }

    public interface IBrowserService
    {
        void Navigate(string url);
    }
}