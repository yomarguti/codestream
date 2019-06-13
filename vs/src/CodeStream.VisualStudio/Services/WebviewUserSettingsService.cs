using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services {

	/// <summary>
	/// Webview settings are saved to something resembling a 'workspace' -- currently, this is
	/// based off of a solution
	/// </summary>
	public class WebviewUserSettingsService {
		private IUserSettingsService _userSettingsService;
		public WebviewUserSettingsService(IUserSettingsService userSettingsService) {
			_userSettingsService = userSettingsService;
		}
		/// <summary>
		/// Saves to a structure like:
		/// codestream
		///		codestream.{solutionName}.{teamId}
		///			data: dictionary[string, object]
		/// </summary>
		/// <param name="context"></param>
		/// <returns></returns>
		public Task<bool> SaveContextAsync(WebviewContext context) {
			if (_userSettingsService == null || context == null || context.CurrentTeamId.IsNullOrWhiteSpace()) return Task.FromResult(false);

			return _userSettingsService.SaveAsync($"{{{{solutionName}}}}.{context.CurrentTeamId}", UserSettingsKeys.WebviewContext, context);
		}

		public async Task<WebviewContext> TryGetWebviewContextAsync(string teamId) {
			if (_userSettingsService == null || teamId.IsNullOrWhiteSpace()) {
				return null;
			}
			return await _userSettingsService.TryGetValueAsync<WebviewContext>($"{{{{solutionName}}}}.{teamId}", UserSettingsKeys.WebviewContext);
		}

		public Task<bool> SaveTeamIdAsync(string teamId) {
			if (_userSettingsService == null || teamId.IsNullOrWhiteSpace()) return Task.FromResult(false);

			return _userSettingsService.SaveAsync($"{{{{solutionName}}}}", UserSettingsKeys.TeamId, teamId);
		}

		public async Task<string> TryGetTeamIdAsync() {
			if (_userSettingsService == null) {
				return null;
			}
			return await _userSettingsService.TryGetValueAsync<string>($"{{{{solutionName}}}}", UserSettingsKeys.TeamId);
		}

		public Task<bool> DeleteTeamIdAsync() {
			if (_userSettingsService == null) return Task.FromResult(false);

			return _userSettingsService.SaveAsync($"{{{{solutionName}}}}", UserSettingsKeys.TeamId, null);
		}
	}

	public static class IUserSettingsServiceExtensions {
		public static Task<bool> SaveContextAsync(this IUserSettingsService userSettingsService, WebviewContext webviewContext) {
			return new WebviewUserSettingsService(userSettingsService).SaveContextAsync(webviewContext);
		}

		public static Task<WebviewContext> TryGetWebviewContextAsync(this IUserSettingsService userSettingsService, string teamId) {
			return new WebviewUserSettingsService(userSettingsService).TryGetWebviewContextAsync(teamId);
		}

		public static Task<bool> TrySaveTeamIdAsync(this IUserSettingsService userSettingsService, string teamId) {
			try {
				return new WebviewUserSettingsService(userSettingsService).SaveTeamIdAsync(teamId);
			}
			catch {
				return Task.FromResult(false);
			}
		}

		public static Task<string> TryGetTeamIdAsync(this IUserSettingsService userSettingsService) {
			try {
				return new WebviewUserSettingsService(userSettingsService).TryGetTeamIdAsync();
			}
			catch {
				return null;
			}
		}
		
		public static Task<bool> TryDeleteTeamIdAsync(this IUserSettingsService userSettingsService) {
			try {
				return new WebviewUserSettingsService(userSettingsService).DeleteTeamIdAsync();
			}
			catch {
				return Task.FromResult(false);
			}
		}
	}
}
