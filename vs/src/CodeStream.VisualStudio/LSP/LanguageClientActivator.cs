using CodeStream.VisualStudio.Core.Logging;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.IO;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.LSP {
	public class LanguageClientActivatorDummy { }
	public static class LanguageClientActivator {
		private static readonly ILogger Log = LogManager.ForContext<LanguageClientActivatorDummy>();
		public static async Task<bool?> InitializeAsync() {
			string path = null;
			try {
				await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

				if (!(Package.GetGlobalService(typeof(DTE)) is EnvDTE80.DTE2 dte)) return false;

				path = Path.Combine(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), "Resources", Core.Constants.CodeStreamCodeStream);

				var window = dte.OpenFile(Constants.vsViewKindCode, path);
				window.Visible = true;
				window.Close(vsSaveChanges.vsSaveChangesNo);
				Log.Information($"{nameof(InitializeAsync)} success for {path}");
				return true;
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(InitializeAsync)} failed for {path}");
				return false;
			}
		}
	}
}
