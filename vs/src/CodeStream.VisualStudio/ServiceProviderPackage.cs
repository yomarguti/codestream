using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.Services;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// Psuedo-package to allow for a custom service provider
    /// </summary>
    [ProvideService(typeof(SHostService))]
    [ProvideService(typeof(SSessionService))]
    [ProvideService(typeof(SSelectedTextService))]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuidString)]
    public sealed class ServiceProviderPackage : AsyncPackage, IServiceContainer, IServiceProvider
    {
        public const string PackageGuidString = "D5CE1488-DEDE-426D-9E5B-BFCCFBE33E54";

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);
            ServiceCreatorCallback callback = new ServiceCreatorCallback(CreateService);

            ((IServiceContainer)this).AddService(typeof(SSessionService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SHostService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSelectedTextService), callback, true);
        }

        private object CreateService(IServiceContainer container, Type serviceType)
        {
            if (typeof(SSessionService) == serviceType)
                return new SessionService(this);
            if (typeof(SHostService) == serviceType)
                return new HostService(this);
            if (typeof(SSelectedTextService) == serviceType)
                return new SelectedTextService(this);

            return null;
        }
    }
}