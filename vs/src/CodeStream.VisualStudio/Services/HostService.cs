using Microsoft.VisualStudio.Shell;
using System.Diagnostics;
using CodeStream.VisualStudio.Annotations;

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
        private readonly IAsyncServiceProvider _serviceProvider;

        public HostService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public void Navigate(string url)
        {
            System.Diagnostics.Process.Start(url);
        }
    }
}