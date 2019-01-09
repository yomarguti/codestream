using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk;
using CodeStream.VisualStudio.Vssdk.Events;
using Microsoft.VisualStudio.PlatformUI;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio
{
    public class CodeStreamEventManager
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamEventManager>();

        private readonly VsShellEventManager _vsShellEventManager;
        private readonly Lazy<ICodeStreamService> _codeStreamService;
        private List<IDisposable> _disposables;

        public CodeStreamEventManager(VsShellEventManager vsShellEventManager,
            Lazy<ICodeStreamService> codeStreamService)
        {
            _vsShellEventManager = vsShellEventManager;
            _codeStreamService = codeStreamService;
        }

        public Action Register(params IDisposable[] disposables)
        {          
            _vsShellEventManager.WindowFocusedEventHandler += OnWindowFocusChanged;
            _vsShellEventManager.VisualStudioThemeChangedEventHandler += OnThemeChanged;

            if (disposables != null && disposables.Length > 0)
            {
                _disposables = new List<IDisposable>();
                _disposables.AddRange(disposables);
            }

            return new Action(() => {
                Unregister();
            });                    
        }

        private void Unregister()
        {          
            _vsShellEventManager.WindowFocusedEventHandler -= OnWindowFocusChanged;
            _vsShellEventManager.VisualStudioThemeChangedEventHandler -= OnThemeChanged;

            if (_disposables != null)
            {
                foreach (var disposable in _disposables)
                {
                    Log.Verbose($"Disposing {disposable?.GetType()}...");
                    disposable?.Dispose();
                }
            }

            _vsShellEventManager?.Dispose();

            Log.Verbose($"Unregistering events");
        }

        public void OnWindowFocusChanged(object sender, WindowFocusChangedEventArgs e)
        {
            if (e.FileName.IsNullOrWhiteSpace() || e.Uri == null) return;

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await _codeStreamService.Value.ChangeActiveWindowAsync(e.FileName, e.Uri);
            });
        }

        public void OnThemeChanged(object sender, ThemeChangedEventArgs e)
        {
            try
            {
                Log.Verbose(nameof(OnThemeChanged));

                _codeStreamService.Value.BrowserService?.LoadWebView();
            }
            catch (Exception ex)
            {
                Log.Error(ex, nameof(OnThemeChanged));
            }
        }         
    }
}