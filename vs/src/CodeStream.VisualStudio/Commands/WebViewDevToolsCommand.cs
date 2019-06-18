using System;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	internal class WebViewDevToolsCommand : VsCommandBase {
		private static readonly ILogger Log = LogManager.ForContext<WebViewDevToolsCommand>();


		public WebViewDevToolsCommand() : base(PackageGuids.guidWebViewPackageCmdSet, PackageIds.WebViewDevToolsCommandId) { }
		protected override void ExecuteUntyped(object parameter) {
			ThreadHelper.ThrowIfNotOnUIThread();
			try {
				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var browserService = componentModel?.GetService<IBrowserService>();
				var url = browserService?.GetDevToolsUrl();
				if (url != null) {
					System.Diagnostics.Process.Start("chrome.exe", url);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(WebViewDevToolsCommand));
			}

		}
	}
}
