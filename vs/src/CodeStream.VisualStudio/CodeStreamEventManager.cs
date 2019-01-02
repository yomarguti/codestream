using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Events;
using Microsoft.VisualStudio.Shell;
using System;
using CodeStream.VisualStudio.Core.Logging;
using Microsoft.VisualStudio.PlatformUI;
using Serilog;

namespace CodeStream.VisualStudio
{
    public class CodeStreamEventManager
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamEventManager>();

        private readonly ICodeStreamService _codeStreamService;
        private readonly IBrowserService _browserService;

        public CodeStreamEventManager(ICodeStreamService codeStreamService, IBrowserService browserService)
        {
            _codeStreamService = codeStreamService;
            _browserService = browserService;
        }

        public void OnWindowFocusChanged(object sender, WindowFocusChangedEventArgs e)
        {
            if (e.FileName.IsNullOrWhiteSpace() || e.Uri == null) return;

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await _codeStreamService.ChangeActiveWindowAsync(e.FileName, e.Uri);
            });
        }

        public void OnThemeChanged(object sender, ThemeChangedEventArgs e)
        {
            try
            {
                Log.Verbose(nameof(OnThemeChanged));

                _browserService?.LoadWebView();
            }
            catch (Exception ex)
            {
                Log.Error(ex, nameof(OnThemeChanged));
            }
        }
    }
}