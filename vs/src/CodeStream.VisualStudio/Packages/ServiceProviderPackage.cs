using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;

namespace CodeStream.VisualStudio.Packages {
	public interface IToolWindowProvider {
		void ToggleToolWindowVisibility(Guid toolWindowId);
		void ShowToolWindowSafe(Guid toolWindowId);
		bool IsVisible(Guid toolWindowId);
	}
	
	public interface SToolWindowProvider { }

	/// <summary>
	/// Pseudo-package to allow for a custom service provider
	/// </summary>
	[ProvideService(typeof(SToolWindowProvider))]
	[ProvideService(typeof(SUserSettingsService))]
	[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
	[Guid(Guids.ServiceProviderPackageId)]
	// ReSharper disable once RedundantExtendsListEntry
	public sealed class ServiceProviderPackage : AsyncPackage, IServiceContainer, IToolWindowProvider, SToolWindowProvider {
		private static readonly ILogger Log = LogManager.ForContext<ServiceProviderPackage>();

		protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress) {		
			try {
				await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

				AsyncPackageHelper.InitializePackage(GetType().Name);

				((IServiceContainer)this).AddService(typeof(SToolWindowProvider), CreateService, true);
				((IServiceContainer)this).AddService(typeof(SUserSettingsService), CreateService, true);

				await base.InitializeAsync(cancellationToken, progress);
			}
            catch(Exception ex) {
				Log.Fatal(ex, nameof(InitializeAsync));
			}
		}

		private object CreateService(IServiceContainer container, Type serviceType) {
			if (typeof(SToolWindowProvider) == serviceType)
				return this;
			if (typeof(SUserSettingsService) == serviceType)
				return new UserSettingsService(this);

			return null;
		}

		private static bool TryGetWindowFrame(Guid toolWindowId, out IVsWindowFrame frame) {
			ThreadHelper.ThrowIfNotOnUIThread();

			var shell = GetGlobalService(typeof(SVsUIShell)) as IVsUIShell;
			if (shell == null || ErrorHandler.Failed(shell.FindToolWindow((uint)__VSCREATETOOLWIN.CTW_fForceCreate, ref toolWindowId, out frame))) {
				frame = null;
				return false;
			}

			return true;
		}

		/// <summary>
		/// Returns true if the ToolWindow is visible
		/// </summary>
		/// <param name="toolWindowId"></param>
		/// <returns>true if visible</returns>
		/// <remarks>
		/// IVsWindowFrame.IsOnScreen checks to see if a window hosted by the Visual Studio IDE has 
		/// been autohidden, or if the window is part of a tabbed display and currently obscured by 
		/// another tab. IsOnScreen also checks to see whether the instance of the Visual Studio IDE 
		/// is minimized or obscured. IsOnScreen differs from the behavior of IsWindowVisible a 
		/// method that may return true even if the window is completely obscured or minimized. 
		/// IsOnScreen also differs from IsVisible which does not check to see if the Visual Studio 
		/// IDE has autohidden the window, or if the window is tabbed and currently obscured by 
		/// another window.
		/// </remarks>
		public bool IsVisible(Guid toolWindowId) {
			ThreadHelper.ThrowIfNotOnUIThread();

			if (!TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame)) {
				return false;
			}

			if (frame.IsOnScreen(out int pfOnScreen) == VSConstants.S_OK) {
				return pfOnScreen == 1;
			}

			return false;
		}

		public void ShowToolWindowSafe(Guid toolWindowId) {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();

				if (!TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame)) return;
				frame.Show();
			}
			catch (Exception) {
				//suffer
			}
		}

		public void ToggleToolWindowVisibility(Guid toolWindowId) {
			ThreadHelper.ThrowIfNotOnUIThread();

			if (TryGetWindowFrame(toolWindowId, out IVsWindowFrame frame)) {
				ErrorHandler.ThrowOnFailure(frame.IsVisible() == VSConstants.S_OK ? frame.Hide() : frame.Show());
			}
		}
	}
}
