using System;

namespace CodeStream.VisualStudio.Core.Models {
	[Flags]
	public enum AgentState {
		Unknown = 0,
		/// <summary>
		/// The LanguageServerProcess is ready
		/// </summary>
		Ready = 1 << 1
	}
}
