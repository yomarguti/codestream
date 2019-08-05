using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Services;
using CodeStream.VisualStudio.Core.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal sealed class WebViewReloadCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<WebViewReloadCommand>();

		public WebViewReloadCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewReloadCommandId) { }

		protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e) {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();
				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var sessionService = componentModel?.GetService<ISessionService>();
				sender.Visible = sessionService?.IsReady == true;
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(WebViewReloadCommand));
			}
		}

		protected override void ExecuteUntyped(object parameter) {
			try {
				ThreadHelper.ThrowIfNotOnUIThread();

				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var browserService = componentModel?.GetService<IBrowserService>();

				browserService?.ReloadWebView();
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(WebViewReloadCommand));
			}
		}
	}
}
