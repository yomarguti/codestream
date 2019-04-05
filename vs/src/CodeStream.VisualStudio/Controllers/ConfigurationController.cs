using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Serilog;

namespace CodeStream.VisualStudio.Controllers {
	public class ConfigurationController {
		private static readonly ILogger Log = LogManager.ForContext<ConfigurationController>();

		private readonly IEventAggregator _eventAggregator;
		private readonly IWebviewIpc _ipc;

		public ConfigurationController(IEventAggregator eventAggregator, IWebviewIpc ipc) {
			_eventAggregator = eventAggregator;
			_ipc = ipc;
		}

		public void ToggleShowMarkerGlyphs(bool value) {
			_eventAggregator.Publish(new MarkerGlyphVisibilityEvent { IsVisible = value });

			Log.Debug($"{nameof(ToggleShowMarkerGlyphs)} Value={value}");

			_ipc.Notify(new HostDidChangeConfigNotificationType {
				Params = new HostDidChangeConfigNotification {
					ShowMarkerGlyphs = value
				}
			});
		}

		public void ToggleShowAvatars(bool value) {
			Log.Debug($"{nameof(ToggleShowAvatars)} Value={value}");

			_ipc.Notify(new HostDidChangeConfigNotificationType {
				Params = new HostDidChangeConfigNotification {
					ShowHeadshots = value
				}
			});
		}
	}
}
