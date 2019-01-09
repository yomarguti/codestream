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
        private readonly IToolWindowProvider _toolWindowProvider;

        [ImportingConstructor]
        protected AuthenticationCommand(ISessionService sessionService, ICodeStreamService codeStreamService, IToolWindowProvider toolWindowProvider)
             : base(CommandSet, CommandId)
        {
            _sessionService = sessionService;
            _codeStreamService = codeStreamService;
            _toolWindowProvider = toolWindowProvider;
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
                _toolWindowProvider.ShowToolWindow(Guids.WebViewToolWindowGuid);
            }
        }

        private void SetText(IOleMenuCommand sender)
        {
            sender.Text = _sessionService.IsReady ? $"{Application.Name}: Sign Out" : $"{Application.Name}: Sign In";
        }
    }
}