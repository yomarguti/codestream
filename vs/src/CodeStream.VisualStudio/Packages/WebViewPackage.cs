using System;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.InteropServices;
using System.Threading;
using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Packages
{
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(WebViewToolWindowPane))]
    [Guid(PackageGuids.guidWebViewPackageString)]
    [SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    public sealed class WebViewPackage : AsyncPackageBase
    {

        //protected override int QueryClose(out bool pfCanClose)
        //{
        //    pfCanClose = true;
        //    // ReSharper disable once ConditionIsAlwaysTrueOrFalse
        //    if (pfCanClose)
        //    {
        //    }
        //    return VSConstants.S_OK;
        //}

        /// <summary>
        /// Initialization of the package; this method is called right after the package is sited, so this is the place
        /// where you can put all the initialization code that rely on services provided by VisualStudio.
        /// </summary>
        /// <param name="cancellationToken">A cancellation token to monitor for initialization cancellation, which can occur when VS is shutting down.</param>
        /// <param name="progress">A provider for progress updates.</param>
        /// <returns>A task representing the async work of package initialization, or an already completed task if there is none. Do not return null from this method.</returns>
        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);

            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            await WebViewToggleCommand.InitializeAsync(this);
            await AuthenticationCommand.InitializeAsync(this);
            await TeamCommand.InitializeAsync(this);
            await AddCodemarkCommand.InitializeAsync(this);
        }
    }
}
