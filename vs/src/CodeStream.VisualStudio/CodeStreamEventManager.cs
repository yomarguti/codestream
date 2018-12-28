using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;

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

            _codeStreamService.ChangeActiveWindow(e.FileName, e.Uri);
        }
    }
}