using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.Commands
{
    [Export(typeof(IAuthenticationCommand))]
    public class AuthenticationCommand : VsCommand, IAuthenticationCommand
    {
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamService _codeStreamService;
        private readonly ICodeStreamToolWindowProvider _codeStreamToolWindowProvider;

        [ImportingConstructor]
        protected AuthenticationCommand(ISessionService sessionService, ICodeStreamService codeStreamService, ICodeStreamToolWindowProvider codeStreamToolWindowProvider)
             : base(CommandSet, CommandId)
        {
            _sessionService = sessionService;
            _codeStreamService = codeStreamService;
            _codeStreamToolWindowProvider = codeStreamToolWindowProvider;
            SetText(this);
        }

        public static readonly Guid CommandSet = new Guid(Guids.AuthenticationCommandCmdSet);
        public const int CommandId = PkgCmdIdList.AuthenticationCommand;

        protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e)
        {
            SetText(sender);
        }

        public override async System.Threading.Tasks.Task ExecuteAsync()
        {
            if (_sessionService.IsReady)
            {
                await _codeStreamService.LogoutAsync();
            }
            else
            {
                _codeStreamToolWindowProvider.ShowToolWindow(Guids.WebViewToolWindowGuid);
            }
        }

        private void SetText(IOleMenuCommand sender)
        {
            sender.Text = _sessionService.IsReady ? "CodeStream: Sign Out" : "CodeStream: Sign In";
        }
    }
}