namespace CodeStream.VisualStudio.Core.Models {
	public class Settings {
		public IOptions Options { get; set; }
		/// <summary>
		/// this is solely the environment name (prod, pd, foo)
		/// </summary>
		public string Env { get; set; }
		/// <summary>
		/// this is the full formatted version
		/// </summary>
		public string Version { get; set; }
	}
}
