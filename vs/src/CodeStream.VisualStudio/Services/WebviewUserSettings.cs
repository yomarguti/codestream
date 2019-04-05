using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.Services {
	public class WebviewUserSettings {
		private IUserSettingsService _userSettingsService;
		public WebviewUserSettings(IUserSettingsService userSettingsService) {
			_userSettingsService = userSettingsService;
		}
		public void SaveContext(WebviewContext context) {
			if (_userSettingsService == null || context == null || context.CurrentTeamId.IsNullOrWhiteSpace()) return;

			_userSettingsService.Save($"{{{{solutionName}}}}.{context.CurrentTeamId}", UserSettingsKeys.WebviewContext, context);
		}

		public bool TryGetWebviewContext<WebviewContext>(string teamId, out WebviewContext val) {
			if (_userSettingsService == null || teamId.IsNullOrWhiteSpace()) {
				val = default(WebviewContext);
				return false;
			}
			return _userSettingsService.TryGetValue($"{{{{solutionName}}}}.{teamId}", UserSettingsKeys.WebviewContext, out val);
		}
	}

	public static class IUserSettingsServiceExtensions {
		public static void SaveContext(this IUserSettingsService settings, WebviewContext context) {
			new WebviewUserSettings(settings).SaveContext(context);
		}

		public static bool TryGetWebviewContext<WebviewContext>(this IUserSettingsService settings, string teamId, out WebviewContext val) {
			return new WebviewUserSettings(settings).TryGetWebviewContext(teamId, out val);
		}
	}
}
