using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Commands {
	internal class WebViewDevToolsCommand : VsCommandBase {
		public WebViewDevToolsCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewDevToolsCommandId) { }
		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();
			var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
			var browserService = componentModel?.GetService<IBrowserService>();
			var url = browserService?.GetDevToolsUrl();
			if (url != null) {
				System.Diagnostics.Process.Start("chrome.exe", url);
			}
		}
	}
}
