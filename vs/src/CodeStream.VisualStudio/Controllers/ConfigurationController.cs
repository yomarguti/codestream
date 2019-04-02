using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Serilog;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Controllers
{
    public class ConfigurationController
    {
        private static readonly ILogger Log = LogManager.ForContext<ConfigurationController>();

        private readonly IEventAggregator _eventAggregator;
        private readonly IWebviewIpc _ipc;

        public ConfigurationController(IEventAggregator eventAggregator, IWebviewIpc ipc)
        {
            _eventAggregator = eventAggregator;
            _ipc = ipc;
        }

        public async Task ToggleShowMarkerGlyphsAsync(bool value)
        {
            _eventAggregator.Publish(new MarkerGlyphVisibilityEvent { IsVisible = value });

            _ipc.Notify(new HostDidChangeConfigNotificationType
            {
                Params = new HostDidChangeConfigNotification
                {
                    ShowMarkerGlyphs = value
                }
            });

            Log.Debug($"{nameof(ToggleShowMarkerGlyphsAsync)} Value={value}");

            await Task.CompletedTask;
        }

        public async Task ToggleShowAvatarsAsync(bool value)
        {
            _ipc.Notify(new HostDidChangeConfigNotificationType
            {
                Params = new HostDidChangeConfigNotification
                {
                    ShowHeadshots = value
                }
            });

            Log.Debug($"{nameof(ToggleShowAvatarsAsync)} Value={value}");

            await Task.CompletedTask;
        }

        public async Task ToggleMuteAllAsync(bool value)
        {
            _ipc.Notify(new HostDidChangeConfigNotificationType
            {
                Params = new HostDidChangeConfigNotification
                {
                    MuteAll = value
                }
            });

            Log.Debug($"{nameof(ToggleMuteAllAsync)} Value={value}");

            await Task.CompletedTask;
        }

        public async Task ToggleViewCodemarksInlineAsync(bool value)
        {
            _ipc.Notify(new HostDidChangeConfigNotificationType
            {
                Params = new HostDidChangeConfigNotification
                {
                    ViewCodemarksInline = value
                }
            });

            Log.Debug($"{nameof(ToggleViewCodemarksInlineAsync)} Value={value}");

            await Task.CompletedTask;
        }
    }
}
