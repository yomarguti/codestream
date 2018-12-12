using CodeStream.VisualStudio.Attributes;
using System.Diagnostics;

namespace CodeStream.VisualStudio.Services
{
    public interface SHostService
    {
    }

    public interface IHostService
    {
        void Navigate(string url);
    }

    [Injected]
    public class HostService : SHostService, IHostService
    {
        private Microsoft.VisualStudio.OLE.Interop.IServiceProvider _serviceProvider;

        public HostService(Microsoft.VisualStudio.OLE.Interop.IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public void Navigate(string url)
        {
            Process.Start(url);
        }
    }
}