using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Settings;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.ComponentModel.Composition;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio
{
    public interface ICodeStreamToolWindowProvider
    {
        void ToggleToolWindowVisibility(Guid toolWindowId);
        void ShowToolWindow(Guid toolWindowId);
        bool IsVisible(Guid toolWindowId);
    }

    public interface SCodeStreamToolWindowProvider { }

    /// <summary>
    /// This is a bit of MEF magic that exports services that were registered with ServiceProviderPackage
    /// for use in classes that use MEF to handle their lifetimes
    /// </summary>
    [PartCreationPolicy(CreationPolicy.Shared)]
    public class ServiceProviderExports
    {
        private readonly IServiceProvider _serviceProvider;

        [ImportingConstructor]
        public ServiceProviderExports([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        [Export]
        private IEventAggregator EventAggregator => GetService<SEventAggregator>() as IEventAggregator;

        [Export]
        private ICodeStreamAgentService CodeStreamAgentService => GetService<SCodeStreamAgentService>() as ICodeStreamAgentService;

        [Export]
        private ISelectedTextService SelectedTextService => GetService<SSelectedTextService>() as ISelectedTextService;

        [Export]
        private ICodeStreamService CodeStreamService => GetService<SCodeStreamService>() as ICodeStreamService;

        [Export]
        private ICodeStreamToolWindowProvider CodeStreamServiceProvider => GetService<SCodeStreamToolWindowProvider>() as ICodeStreamToolWindowProvider;

        [Export]
        private ISessionService SessionService => GetService<SSessionService>() as ISessionService;

        private T GetService<T>() where T : class
        {
            var service = (T)_serviceProvider.GetService(typeof(T));
            return service;
        }
    }

    public interface IServiceLocator
    {
        Task<object> GetServiceAsync(Type serviceType);
        Task<object> GetServiceAsync(Type serviceType, bool swallowExceptions);
        object GetService(Type serviceType);
    }

    /// <summary>
    /// Pseudo-package to allow for a custom service provider
    /// </summary>
    [ProvideService(typeof(SCodeStreamToolWindowProvider))]
    [ProvideService(typeof(SEventAggregator))]
    [ProvideService(typeof(SIdeService))]
    [ProvideService(typeof(SSessionService))]
    [ProvideService(typeof(SSelectedTextService))]
    [ProvideService(typeof(SBrowserService))]
    [ProvideService(typeof(SCodeStreamAgentService))]
    [ProvideService(typeof(SCodeStreamService))]
    [ProvideService(typeof(SSettingsService))]
   // [ProvideService(typeof(IServiceLocator))]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(Guids.ServiceProviderPackageId)]
    // ReSharper disable once RedundantExtendsListEntry

    public sealed class ServiceProviderPackage : AsyncPackage, IServiceContainer,
           ICodeStreamToolWindowProvider, SCodeStreamToolWindowProvider, IServiceLocator
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

            ((IServiceContainer)this).AddService(typeof(SCodeStreamToolWindowProvider), callback, true);
            ((IServiceContainer)this).AddService(typeof(SEventAggregator), callback, true);
            ((IServiceContainer)this).AddService(typeof(SIdeService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSessionService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSelectedTextService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SBrowserService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamAgentService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SCodeStreamService), callback, true);
            ((IServiceContainer)this).AddService(typeof(SSettingsService), callback, true);
            //((IServiceContainer)this).AddService(typeof(IServiceLocator), callback, true);
        }

        private object CreateService(IServiceContainer container, Type serviceType)
        {
            if (typeof(SCodeStreamToolWindowProvider) == serviceType)
                return this;
            if (typeof(SEventAggregator) == serviceType)
                return new EventAggregator();
            if (typeof(SIdeService) == serviceType)
                return new IdeService();
            if (typeof(SSessionService) == serviceType)
                return new SessionService(this);
            if (typeof(SSelectedTextService) == serviceType)
                return new SelectedTextService(null, GetService(typeof(SVsTextManager)) as IVsTextManager2);
            if (typeof(SBrowserService) == serviceType)
                return new DotNetBrowserService(this);
            if (typeof(SSettingsService) == serviceType)
                return new SettingsService(_codeStreamOptions);
            if (typeof(SCodeStreamAgentService) == serviceType)
                return new CodeStreamAgentService(GetService(typeof(SSessionService)) as ISessionService, this);
            if (typeof(SCodeStreamService) == serviceType)
                return new CodeStreamService(
                    GetService(typeof(SSessionService)) as ISessionService,
                    GetService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService,
                    GetService(typeof(SBrowserService)) as IBrowserService
                );
            //if (typeof(IServiceLocator) == serviceType)
            //    return this;

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

        object IServiceLocator.GetService(Type serviceType)
        {
            return GetService(serviceType);
        }
    }
}