using CodeStream.VisualStudio.UI.ToolWindows;
using Microsoft.VisualStudio.Shell;
using System.Runtime.InteropServices;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// This is the host package for the <see cref="GitHubPane"/> tool window.
    /// </summary>
    /// <remarks>
    /// This package mustn't use MEF.
    /// See: https://github.com/github/VisualStudio/issues/1550
    /// </remarks>
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(Guids.WebViewPackageId)]
    [ProvideToolWindow(typeof(WebViewToolWindow), Orientation = ToolWindowOrientation.Right)]
    public sealed class WebViewPackage : AsyncPackage
    {

    }
}