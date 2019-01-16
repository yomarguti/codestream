using CodeStream.VisualStudio.Events;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio;
using CodeStream.VisualStudio.UI.Settings;
using Microsoft.VisualStudio.ExtensionManager;
using Microsoft.VisualStudio.TextManager.Interop;

namespace CodeStream.VisualStudio
{
    public interface IToolWindowProvider
    {
        void ToggleToolWindowVisibility(Guid toolWindowId);
        void ShowToolWindow(Guid toolWindowId);
        bool IsVisible(Guid toolWindowId);
    }

    public interface SToolWindowProvider { }

    /// <summary>
    /// Pseudo-package to allow for a custom service provider
    /// </summary>
    [ProvideService(typeof(SToolWindowProvider))]
    [ProvideService(typeof(SEventAggregator))]
    [ProvideService(typeof(SIdeService))]
    [ProvideService(typeof(SCredentialsService))]
    [ProvideService(typeof(SSessionService))]
    [ProvideService(typeof(SBrowserService))]
    [ProvideService(typeof(SCodeStreamAgentService))]
    [ProvideService(typeof(SCodeStreamService))]
    [ProvideService(typeof(SSettingsService))]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(Guids.ServiceProviderPackageId)]
    // ReSharper disable once RedundantExtendsListEntry
    public sealed class ServiceProviderPackage : AsyncPackage, IServiceContainer,
           IToolWindowProvider, SToolWindowProvider
    {
        /// <summary>
        /// Store a reference to this as only a class that inherits from AsyncPackage can call GetDialogPage
        /// </summary>
        private OptionsDialogPage _codeStreamOptions;

        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            var callback = new ServiceCreatorCallback(CreateService);
            _codeStreamOptions = (OptionsDialogPage)GetDialogPage(typeof(OptionsDialogPage));

            ((IServiceContainer)this).AddService(typeof(SToolWindowProvider), callback, true);
            ((IServiceContainer)this).AddService(typeof(SEventAggregator), callback, true);
            ((IServiceContainer)this).AddService(typeof(SIdeService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCredentialsService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSessionService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SBrowserService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamAgentService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSettingsService), callback, true);
        }

        private object CreateService(IServiceContainer container, Type serviceType)
        {
            if (typeof(SToolWindowProvider) == serviceType)
                return this;
            if (typeof(SEventAggregator) == serviceType)
                return new EventAggregator();
            if (typeof(SIdeService) == serviceType)
                return new IdeService(
                    GetService(typeof(SVsTextManager)) as IVsTextManager2,
                    GetService(typeof(SVsExtensionManager)) as IVsExtensionManager
                );
            if (typeof(SCredentialsService) == serviceType)
                return new CredentialsService();
            if (typeof(SSessionService) == serviceType)
                return new SessionService();
            if (typeof(SBrowserService) == serviceType)
                return new DotNetBrowserService();
            if (typeof(SSettingsService) == serviceType)
                return new SettingsService(_codeStreamOptions);
            if (typeof(SCodeStreamAgentService) == serviceType)
                return new CodeStreamAgentService(
                    GetService(typeof(SSessionService)) as ISessionService,
                    GetService(typeof(SSettingsService)) as ISettingsService);
            if (typeof(SCodeStreamService) == serviceType)
                return new CodeStreamService(
                    new Lazy<ICredentialsService>(() => GetService(typeof(SCredentialsService)) as ICredentialsService),
                    new Lazy<IEventAggregator>(() => GetService(typeof(SEventAggregator)) as IEventAggregator),
                    GetService(typeof(SSessionService)) as ISessionService,
                    GetService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                    GetService(typeof(SBrowserService)) as IBrowserService,
                    new Lazy<ISettingsService>(() => GetService(typeof(SSettingsService)) as ISettingsService)
                );

            return null;
        }

        private static bool TryGetWindowFrame(Guid toolWindowId, out IVsWindowFrame frame)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var shell = GetGlobalService(typeof(SVsUIShell)) as IVsUIShell;
            if (shell == null || ErrorHandler.Failed(shell.FindToolWindow((uint)__VSCREATETOOLWIN.CTW_fForceCreate, ref toolWindowId, out frame)))
            {
                frame = null;
                return false;
            }

            return true;
        }

        public bool IsVisible(Guid toolWindowId)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            return TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame) && frame.IsVisible() == VSConstants.S_OK;
        }

        public void ShowToolWindow(Guid toolWindowId)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (!TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame)) return;

            frame.Show();
        }

        public void ToggleToolWindowVisibility(Guid toolWindowId)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame))
            {
                ErrorHandler.ThrowOnFailure(frame.IsVisible() == VSConstants.S_OK ? frame.Hide() : frame.Show());
            }
        }
    }     
}
