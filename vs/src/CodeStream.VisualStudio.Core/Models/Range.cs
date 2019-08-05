namespace CodeStream.VisualStudio.Core.Models {
	/// <summary>
	/// This is a copy of the Range object that ships with MS.LanguageServer.Protocol
	/// </summary>
	public class Range {
		public Position Start { get; set; }

		public Position End { get; set; }
	}
}
