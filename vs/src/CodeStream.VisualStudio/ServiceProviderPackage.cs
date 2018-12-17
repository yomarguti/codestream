using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// Psuedo-package to allow for a custom service provider
    /// </summary>
    [ProvideService(typeof(SHostService))]
    [ProvideService(typeof(SSessionService))]
    [ProvideService(typeof(SSelectedTextService))]
    [ProvideService(typeof(SBrowserService))]
    [ProvideService(typeof(SCodeStreamAgentService))]
    [ProvideService(typeof(SCodeStreamService))]
    [ProvideService(typeof(SSettingsService))]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuidString)]
    public sealed class ServiceProviderPackage : AsyncPackage, IServiceContainer, IAsyncServiceProvider
    {
        public const string PackageGuidString = "D5CE1488-DEDE-426D-9E5B-BFCCFBE33E54";

        /// <summary>
        /// Store a reference to this as only a class that inherits from AsyncPackage can call GetDialogPage
        /// </summary>
        private CodeStreamOptionsDialogPage codeStreamOptions;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);           

            await this.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            ServiceCreatorCallback callback = new ServiceCreatorCallback(CreateService);
            codeStreamOptions = (CodeStreamOptionsDialogPage)GetDialogPage(typeof(CodeStreamOptionsDialogPage));

            ((IServiceContainer)this).AddService(typeof(SSessionService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SHostService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSelectedTextService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SBrowserService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamAgentService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamService), callback, true);            
            ((IServiceContainer)this).AddService(typeof(SSettingsService), callback, true);
        }

        private object CreateService(IServiceContainer container, Type serviceType)
        {
            if (typeof(SSessionService) == serviceType)
                return new SessionService(this);
            if (typeof(SHostService) == serviceType)
                return new HostService(this);
            if (typeof(SSelectedTextService) == serviceType)
                return new SelectedTextService(GetService(typeof(SVsTextManager)) as IVsTextManager);
            if (typeof(SBrowserService) == serviceType)
                return new DotNetBrowserService(this);
            if (typeof(SSettingsService) == serviceType)
                return new SettingsService(codeStreamOptions as ICodeStreamOptionsDialogPage);
            if (typeof(SCodeStreamAgentService) == serviceType)
                return new CodeStreamAgentService(this);
            if (typeof(SCodeStreamService) == serviceType)
                return new CodeStreamService(
                    GetService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                    GetService(typeof(SBrowserService)) as IBrowserService
                );

            return null;
        }
    }
}