using CodeStream.VisualStudio.Properties;
using CodeStream.VisualStudio.UI.Settings;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using System;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.UI;

namespace CodeStream.VisualStudio.Packages
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", SolutionInfo.Version, IconResourceID = 400)]
    [ProvideOptionPage(typeof(OptionsDialogPage), "CodeStream", "Settings", 0, 0, true)]
    [Guid(Guids.CodeStreamPackageId)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionOpening_string, PackageAutoLoadFlags.BackgroundLoad)]
    public sealed class CodeStreamPackage : AsyncPackage
    {
        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken,
            IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);
            AsyncPackageHelper.InitializePackage(GetType().Name);
 
            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            InfoBarProvider.Initialize(this);
        }
    }
}
