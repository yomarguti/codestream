using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Runtime.Serialization;

namespace CodeStream.VisualStudio.Services {
	public interface ISessionService {
		User User { get; }
		JToken State { get; }
		void SetState(AgentState state);
		void SetState(SessionState state);
		SessionState SessionState { get; }
		void SetUser(User user, JToken state);
		void SetAgentDisconnected();
		List<string> PanelStack { get; set; }
		bool IsCodemarksForFileVisible { get; set; }
		bool IsWebViewVisible { get; set; }
		bool AreMarkerGlyphsVisible { get; set; }
		string LastActiveFileUrl { get; set; }

		/// <summary>
		/// Session is ready when the agent has loaded and the user has logged in
		/// </summary>
		bool IsReady { get; }
		bool IsAgentReady { get; }
		void Logout();
		string LiveShareUrl { get; set; }
		string StateString { get; }
		bool? WebViewDidInitialize { get; set; }
	}

	[Export(typeof(ISessionService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class SessionService : ISessionService, IDisposable {
		private AgentState _agentState;

		public User User { get; private set; }
		public JToken State { get; private set; }
        public SessionState SessionState { get; private set; }
        public List<string> PanelStack { get; set; }
		public bool IsWebViewVisible { get; set; }
		public bool AreMarkerGlyphsVisible { get; set; } = true;
		public bool IsCodemarksForFileVisible { get; set; }
		public string LastActiveFileUrl { get; set; }
		public bool? WebViewDidInitialize { get; set; }
		private bool _disposed = false;

		public SessionService() {
			// for breakpointing
		}

		public string StateString => SessionState.ToString();
		private static readonly object locker = new object();

		public void SetState(AgentState state) {
			lock (locker) {
				switch (state) {
					case AgentState.Ready: {
							_agentState = AgentState.Ready;
							break;
						}
				}
			}
		}

		public void SetState(SessionState sessionState) {
			lock (locker) {
				SessionState = sessionState;
			}
		}

		public void SetAgentDisconnected() {
			SetState(SessionState.Unknown);
		}

		public void SetUser(User user, JToken state) {
			User = user;
			State = state;
		}

		public void Logout() {
			WebViewDidInitialize = false;
			User = null;
			State = null;
			SetState(SessionState.UserSignedOut);
		}

		public bool IsAgentReady => _agentState == AgentState.Ready;

		public bool IsReady => _agentState == AgentState.Ready && SessionState == SessionState.UserSignedIn;

		public string LiveShareUrl { get; set; }

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed)
				return;

			if (disposing) {
				SessionState = SessionState.Unknown;
			}

			_disposed = true;
		}
	}

	public class User {
		public User(string id, string userName, string emailAddress, string teamName, int teamCount) {
			Id = id;
			UserName = userName;
			EmailAddress = emailAddress;
			TeamName = teamName;
			TeamCount = teamCount;
		}

		public string Id { get; }
		public string TeamName { get; }
		public string UserName { get; }
		public string EmailAddress { get; }
		public int TeamCount { get; set; }

		public bool HasSingleTeam() => TeamCount == 1;
	}

	[Serializable]
	public class AgentStateException : Exception {
		public AgentStateException() { }

		public AgentStateException(string message) : base(message) { }

		public AgentStateException(string message, Exception innerException) : base(message, innerException) { }

		protected AgentStateException(SerializationInfo info, StreamingContext context) : base(info, context) { }
	}

	[Flags]
	public enum AgentState {
		Unknown = 0,
		/// <summary>
		/// The LanguageServerProcess is ready
		/// </summary>
		Ready = 1 << 1
	}

	[Flags]
	public enum SessionState {
		Unknown = 0,
		/// <summary>
		/// User is in the process of signing in
		/// </summary>
		UserSigningIn = 1 << 1,
		/// <summary>
		/// The user has authenticated
		/// </summary>
		UserSignedIn = 1 << 2,
		/// <summary>
		/// The user is signing out
		/// </summary>
		UserSigningOut = 1 << 3,
		/// <summary>
		/// The user has signed out
		/// </summary>
		UserSignedOut = 1 << 4,
		/// <summary>
		/// The user has failed signing in
		/// </summary>
		UserSignInFailed = 1 << 5
	}
}
