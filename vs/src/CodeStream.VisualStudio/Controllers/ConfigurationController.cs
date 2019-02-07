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
        private readonly IBrowserService _browserService;

        public ConfigurationController(IEventAggregator eventAggregator, IBrowserService browserService)
        {
            _eventAggregator = eventAggregator;
            _browserService = browserService;
        }

        public async Task UpdateOpenCommentOnSelectAsync(bool value)
        {
            _eventAggregator.Publish(new CodeStreamConfigurationChangedEvent() { OpenCommentOnSelect = value });
            _browserService.PostMessage(Ipc.ToCommentOnSelectMessage(value));
            await Task.CompletedTask;
        }

        public async Task ToggleShowMarkersAsync(bool value)
        {
            _eventAggregator.Publish(new CodemarkVisibilityEvent { IsVisible = value });
            _browserService.PostMessage(Ipc.ToShowMarkersMessage(value));
            await Task.CompletedTask;
        }

        public async Task ToggleMuteAllAsync(bool value)
        {
            _browserService.PostMessage(Ipc.ToMuteAllMessage(value));
            await Task.CompletedTask;
        }
    }
}
