using System.Threading.Tasks;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.Services {
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
}
