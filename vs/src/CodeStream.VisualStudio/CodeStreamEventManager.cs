using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Events;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio
{
    public class CodeStreamEventManager
    {
        private readonly ICodeStreamService _codeStreamService;

        public CodeStreamEventManager(ICodeStreamService codeStreamService)
        {
            _codeStreamService = codeStreamService;
        }

        public void OnWindowFocusChanged(object sender, WindowFocusChangedEventArgs e)
        {
            if (e.FileName.IsNullOrWhiteSpace() || e.Uri == null) return;

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await _codeStreamService.ChangeActiveWindowAsync(e.FileName, e.Uri);
            });
        }
    }
}