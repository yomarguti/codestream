namespace CodeStream.VisualStudio.Core.Logging {
	public enum TraceLevel {
		Silent,
		Errors,
		// info doesn't exist in the Agent -- but does in the extension, map it to Errors
		Info,
		Debug,
		Verbose
	}
}
