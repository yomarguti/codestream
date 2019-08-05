using System;
using System.Runtime.Serialization;

namespace CodeStream.VisualStudio.Core.Models {
	[Serializable]
	public class AgentStateException : Exception {
		public AgentStateException() { }

		public AgentStateException(string message) : base(message) { }

		public AgentStateException(string message, Exception innerException) : base(message, innerException) { }

		protected AgentStateException(SerializationInfo info, StreamingContext context) : base(info, context) { }
	}
}
