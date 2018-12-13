using CodeStream.VisualStudio.Attributes;
using System;
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
        private IServiceProvider _serviceProvider;

        public HostService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public void Navigate(string url)
        {
            Process.Start(url);
        }
    }
}