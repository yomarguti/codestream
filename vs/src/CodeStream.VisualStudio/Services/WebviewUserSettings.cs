using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services {

	/// <summary>
	/// Webview settings are saved to something resembling a 'workspace' -- currently, this is
	/// based off of a solution
	/// </summary>
	public class WebviewUserSettings {
		private IUserSettingsService _userSettingsService;
		public WebviewUserSettings(IUserSettingsService userSettingsService) {
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
	}

	public static class IUserSettingsServiceExtensions {
		public static Task<bool> SaveContextAsync(this IUserSettingsService userSettingsService, WebviewContext webviewContext) {
			return new WebviewUserSettings(userSettingsService).SaveContextAsync(webviewContext);
		}

		public static Task<WebviewContext> TryGetWebviewContextAsync(this IUserSettingsService userSettingsService, string teamId) {
			return new WebviewUserSettings(userSettingsService).TryGetWebviewContextAsync(teamId);
		}
	}
}
