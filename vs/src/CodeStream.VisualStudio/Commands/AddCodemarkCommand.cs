using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.ComponentModel.Composition;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Commands
{
    public interface IAddCodemarkCommand : IVsCommand
    {

    }

    [Export(typeof(IAddCodemarkCommand))]
    public class AddCodemarkCommand : VsCommand, IAddCodemarkCommand
    {
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamService _codeStreamService;
        private readonly ISelectedTextService _selectedTextService;

        [ImportingConstructor]
        public AddCodemarkCommand(ISessionService sessionService, ICodeStreamService codeStreamService, ISelectedTextService selectedTextService) : base(CommandSet, CommandId)
        {
            _sessionService = sessionService;
            _codeStreamService = codeStreamService;
            _selectedTextService = selectedTextService;
        }

        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        [Import]
        public IVsEditorAdaptersFactoryService EditorAdaptersFactoryService { get; set; }

        public static readonly Guid CommandSet = new Guid(Guids.AddCodemarkCommandCmdSet);
        public const int CommandId = PkgCmdIdList.AddCodemarkCommand;

        public override async Task ExecuteAsync()
        {
            var selectedText = _selectedTextService.GetSelectedText(out IVsTextView view);
            if (view != null)
            {
                var wpfTextView = EditorAdaptersFactoryService.GetWpfTextView(view);
                if (wpfTextView != null)
                {
                    if (TextDocumentFactoryService.TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument))
                    {
                        await _codeStreamService.PostCodeAsync(new Uri(textDocument.FilePath), selectedText,
                            true, CancellationToken.None);
                    }
                }
            }
        }

        protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e)
        {
            sender.Visible = _sessionService.IsReady;
        }
    }
}
