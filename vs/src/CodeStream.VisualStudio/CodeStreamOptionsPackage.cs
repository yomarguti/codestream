using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.InteropServices;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio
{
    public interface ICodeStreamOptionsDialogPage
    {
        string Email { get; set; }
        bool ShowMarkers { get; set; }
        bool ShowHeadshots { get; set; }
        string ServerUrl { get; set; }
        string WebAppUrl { get; set; }
        string Team { get; set; }
        bool OpenCommentOnSelect { get; set; }
        void SaveSettingsToStorage();
        void LoadSettingsFromStorage();
    }

    public class CodeStreamOptionsDialogPage : DialogPage, ICodeStreamOptionsDialogPage
    {
        [Category("CodeStream")]
        [DisplayName("Email")]
        [Description("")]
        public string Email { get; set; }

        [Category("CodeStream")]
        [DisplayName("Show Markers")]
        [Description("Specifies whether to show CodeStream markers in editor margins")]
        public bool ShowMarkers { get; set; } = true;

        [Category("CodeStream")]
        [DisplayName("Avatars")]
        [Description("Specifies whether to show avatars")]
        public bool ShowHeadshots { get; set; } = true;

        [Category("CodeStream")]
        [DisplayName("Server Url")]
        [Description("Specifies the url to use to connect to the CodeStream service")]
#if DEBUG
        public string ServerUrl { get; set; } = "https://pd-api.codestream.us:9443";
#else 
        public string ServerUrl { get; set; } = "https://api.codestream.com";
#endif

        [Category("CodeStream")]
        [DisplayName("Web App Url")]
        [Description("Specifies the url for the CodeStream web portal")]
#if DEBUG
        public string WebAppUrl { get; set; } = "http://pd-app.codestream.us:1380";
#else
        public string WebAppUrl { get; set; } = "http://app.codestream.com";
#endif

        [Category("CodeStream")]
        [DisplayName("Team")]
        [Description("Specifies an optional team to connect to the CodeStream service")]
        public string Team { get; set; }

        [Category("CodeStream")]
        [DisplayName("Open Comment On Select")]
        [Description("Specifies whether to automatically open the comment dialog when the CodeStream panel is open and you select code")]
        public bool OpenCommentOnSelect { get; set; }
    }

    /// <summary>
    /// This is the class that implements the package exposed by this assembly.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The minimum requirement for a class to be considered a valid package for Visual Studio
    /// is to implement the IVsPackage interface and register itself with the shell.
    /// This package uses the helper classes defined inside the Managed Package Framework (MPF)
    /// to do it: it derives from the Package class that provides the implementation of the
    /// IVsPackage interface and uses the registration attributes defined in the framework to
    /// register itself and its components with the shell. These attributes tell the pkgdef creation
    /// utility what data to put into .pkgdef file.
    /// </para>
    /// <para>
    /// To get loaded into VS, the package must be referred by &lt;Asset Type="Microsoft.VisualStudio.VsPackage" ...&gt; in .vsixmanifest file.
    /// </para>
    /// </remarks>
    [ProvideOptionPage(typeof(CodeStreamOptionsDialogPage), "CodeStream", "Settings", 0, 0, true)]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#3110", "#3112", "1.0", IconResourceID = 3400)] // Info on this package for Help/About
    [Guid(CodeStreamOptionsPackage.PackageGuidString)]
    [SuppressMessage("StyleCop.CSharp.DocumentationRules", "SA1650:ElementDocumentationMustBeSpelledCorrectly", Justification = "pkgdef, VS and vsixmanifest are valid VS terms")]
    public sealed class CodeStreamOptionsPackage : AsyncPackage
    {
        /// <summary>
        /// CodeStreamOptionsPackage GUID string.
        /// </summary>
        public const string PackageGuidString = "5918a618-0520-4134-9133-4d8d4242ac6e";

        /// <summary>
        /// Initializes a new instance of the <see cref="CodeStreamOptionsPackage"/> class.
        /// </summary>
        public CodeStreamOptionsPackage()
        {
            // Inside this method you can place any initialization code that does not require
            // any Visual Studio service because at this point the package object is created but
            // not sited yet inside Visual Studio environment. The place to do all the other
            // initialization is the Initialize method.
        }

        #region Package Members

        /// <summary>
        /// Initialization of the package; this method is called right after the package is sited, so this is the place
        /// where you can put all the initialization code that rely on services provided by VisualStudio.
        /// </summary>
        /// <param name="cancellationToken">A cancellation token to monitor for initialization cancellation, which can occur when VS is shutting down.</param>
        /// <param name="progress">A provider for progress updates.</param>
        /// <returns>A task representing the async work of package initialization, or an already completed task if there is none. Do not return null from this method.</returns>
        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            // When initialized asynchronously, the current thread may be a background thread at this point.
            // Do any initialization that requires the UI thread after switching to the UI thread.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        }

        #endregion
    }
}
