using System.Collections.Generic;
using CodeStream.VisualStudio.Core.Models;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Core.Services {
	public interface ISessionService {
		User User { get; }
		JToken State { get; }
		void SetState(AgentState state);
		void SetState(SessionState state);
		SessionState SessionState { get; }
		void SetUser(User user, JToken state);
		void SetAgentDisconnected();
		List<string> PanelStack { get; set; }
		/// <summary>
		/// Also known as Spatial view
		/// </summary>
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
}
