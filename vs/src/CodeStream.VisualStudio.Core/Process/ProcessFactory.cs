using CodeStream.VisualStudio.Core.Logging;
using Serilog;
using System;
using System.Diagnostics;

namespace CodeStream.VisualStudio.Core.Process {
	public class ProcessFactory {
		private static readonly ILogger Log = LogManager.ForContext<ProcessFactory>();

		/// <summary>
		/// Create a process
		/// </summary>
		/// <param name="fileName"></param>
		/// <param name="arguments"></param>
		/// <returns></returns>
		public static System.Diagnostics.Process Create(string fileName, string arguments, bool useNodeOptions = true) {
			var info = new ProcessStartInfo {
				FileName = fileName,
				Arguments = arguments,
				RedirectStandardInput = true,
				RedirectStandardOutput = true,
				UseShellExecute = false,
				CreateNoWindow = true
			};

			if (!useNodeOptions) {
				try {
					info.EnvironmentVariables.Remove("NODE_OPTIONS");
				}
				catch (Exception ex) {
					Log.Error(ex, "Could not remove NODE_OPTIONS");
				}
			}

			return new System.Diagnostics.Process() {
				StartInfo = info
			};
		}
	}
}
