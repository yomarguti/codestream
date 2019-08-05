using CodeStream.VisualStudio.Core.Logging;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.IO;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Core.LanguageServer {
	public class LanguageClientActivatorDummy { }
	public static class LanguageClientActivator {
		private static readonly ILogger Log = LogManager.ForContext<LanguageClientActivatorDummy>();
		public static async Task<bool?> InitializeAsync(DTE dte) {
			if (dte == null) return false;
			string path = null;
			try {
				await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
				path = Path.Combine(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), "Resources", Constants.CodeStreamCodeStream);

				var window = dte.OpenFile(EnvDTE.Constants.vsViewKindCode, path);
				window.Visible = true;
				window.Close(vsSaveChanges.vsSaveChangesNo);
				Log.Debug($"{nameof(InitializeAsync)} success for {path}");
				return true;
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(InitializeAsync)} failed for {path}");
				return false;
			}
		}
	}
}
