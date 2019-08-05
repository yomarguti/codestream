namespace CodeStream.VisualStudio.Core {
	public static class ProcessExtensions {
		public static bool IsVisualStudioProcess() =>
			System.Diagnostics.Process.GetCurrentProcess().ProcessName == "devenv";
	}
}
