using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Commands {
	internal class WebViewDevToolsCommand : VsCommandBase {
		public WebViewDevToolsCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewDevToolsCommandId) { }
		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();

			var browserService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
			var url = browserService?.GetDevToolsUrl();
			if (url != null) {
				System.Diagnostics.Process.Start("chrome.exe", url);
			}
		}
	}
}
