using CodeStream.VisualStudio.Commands;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.UI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.InteropServices;
using System.Threading;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// This package only loads when the FooLanguageClient.UiContextGuidString UI context is set.  This ensures that this extension is only loaded when the language server is activated.
    /// </summary>
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", "1.0", IconResourceID = 400)] // Info on this package for Help/About
    [ProvideMenuResource("Menus.ctmenu", 1)]    
    [Guid(PackageGuidString)]
    [SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    [ProvideToolWindow(typeof(WebViewToolWindow))]
    public sealed class WebViewPackage : AsyncPackage
    {
        static readonly ILogger Log = LogManager.ForContext<WebViewPackage>();

        public const string PackageGuidString = "330ce502-4e1f-44b8-ab32-82a7ea71beeb";

        public WebViewPackage()
        {
        }

        /// <summary>
        /// Initialization of the package; this method is called right after the package is sited, so this is the place
        /// where you can put all the initialization code that rely on services provided by VisualStudio.
        /// </summary>
        /// <param name="cancellationToken">A cancellation token to monitor for initialization cancellation, which can occur when VS is shutting down.</param>
        /// <param name="progress">A provider for progress updates.</param>
        /// <returns>A task representing the async work of package initialization, or an already completed task if there is none. Do not return null from this method.</returns>
        protected override async System.Threading.Tasks.Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);
           
            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            await WebViewCommand.InitializeAsync(this);
            
            var hostVersionInfo = Application.HostVersion;

            Log.Information("Initializing GitHub Extension v{PackageVersion} in {$ProductName} ({$ProductVersion})",
                Application.Version, Application.ProductName, Application.ProductVersion);

        }
    }
}