using System.Threading.Tasks;
using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.Services {
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
