using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;
using System;

namespace CodeStream.VisualStudio.Commands {
	internal sealed class WebViewReloadCommand : VsCommandBase {
		public WebViewReloadCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewReloadCommandId) {}

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			ThreadHelper.ThrowIfNotOnUIThread();
			var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
			sender.Visible = sessionService?.IsReady == true;
		}

		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();

			var browserService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SBrowserService)) as IBrowserService;
			browserService?.ReloadWebView();
		}
	}
}
