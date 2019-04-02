using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Events;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;

namespace CodeStream.VisualStudio
{
    /// <summary>
    /// Attaches CodeStream-specific handlers to VisualStudio events
    /// </summary>
    public class CodeStreamEventManager: IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamEventManager>();

        private readonly VsShellEventManager _vsShellEventManager;
        private readonly Lazy<ICodeStreamService> _codeStreamService;

        public CodeStreamEventManager(VsShellEventManager vsShellEventManager,
            Lazy<ICodeStreamService> codeStreamService)
        {
            _vsShellEventManager = vsShellEventManager;
            _codeStreamService = codeStreamService;

            _vsShellEventManager.WindowFocusedEventHandler += OnWindowFocusChanged;
            _vsShellEventManager.VisualStudioThemeChangedEventHandler += OnThemeChanged;
            _vsShellEventManager.BeforeSolutionClosingEventHandler += BeforeSolutionClosingEventHandler;
        }

        private void BeforeSolutionClosingEventHandler(object sender, EventArgs e)
        {
            Log.Information("Solution is closing");
        }

        private void OnWindowFocusChanged(object sender, WindowFocusChangedEventArgs e)
        {
            if (e.FileName.IsNullOrWhiteSpace() || e.Uri == null) return;
            if (e.FileName.EndsWith(Core.Constants.CodeStreamCodeStream))
            {
                Log.Verbose($"{nameof(OnWindowFocusChanged)} ignoring {e.FileName}");
                return;
            }

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await _codeStreamService.Value.ChangeActiveWindowAsync(e.FileName, e.Uri);
            });
        }

        private void OnThemeChanged(object sender, ThemeChangedEventArgs e)
        {
            try
            {
                Log.Information(nameof(OnThemeChanged));

                _codeStreamService.Value.WebviewIpc?.BrowserService?.ReloadWebView();
            }
            catch (Exception ex)
            {
                Log.Error(ex, nameof(OnThemeChanged));
            }
        }

        private bool _disposedValue;

        private void Dispose(bool disposing)
        {
            System.Windows.Threading.Dispatcher.CurrentDispatcher.VerifyAccess();

            if (!_disposedValue)
            {
                if (disposing)
                {
                    _vsShellEventManager.WindowFocusedEventHandler -= OnWindowFocusChanged;
                    _vsShellEventManager.VisualStudioThemeChangedEventHandler -= OnThemeChanged;
                    _vsShellEventManager.BeforeSolutionClosingEventHandler -= BeforeSolutionClosingEventHandler;

                    Log.Debug($"Unregistering events");
                }

                _disposedValue = true;
            }
        }

        public void Dispose()
        {
            Dispose(true);
        }
    }
}
