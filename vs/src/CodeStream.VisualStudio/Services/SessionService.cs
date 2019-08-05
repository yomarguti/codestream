using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Services;

namespace CodeStream.VisualStudio.Services {
 

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
		/// <summary>
		/// Also known as Spatial view
		/// </summary>
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

 
}
