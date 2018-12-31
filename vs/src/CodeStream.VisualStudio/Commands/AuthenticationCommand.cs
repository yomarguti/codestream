using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.Vssdk.Commands;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Commands
{
    [Export(typeof(IAuthenticationCommand))]
    public class AuthenticationCommand : VsCommand, IAuthenticationCommand
    {
        private readonly ISessionService _sessionService;
        private readonly ICodeStreamToolWindowProvider _codeStreamToolWindowProvider;

       [ImportingConstructor]
        protected AuthenticationCommand(ISessionService sessionService, ICodeStreamToolWindowProvider codeStreamToolWindowProvider)
            : base(CommandSet, CommandId)
        {
            _sessionService = sessionService;
            _codeStreamToolWindowProvider = codeStreamToolWindowProvider;
            SetText(this);
        }

        public static readonly Guid CommandSet = new Guid(Guids.AuthenticationCommandCmdSet);
        public const int CommandId = PkgCmdIDList.AuthenticationCommand;

        protected override void OnBeforeQueryStatus(OleMenuCommand sender, EventArgs e)
        {
            SetText(sender);
        }

        public override System.Threading.Tasks.Task Execute()
        {
            _codeStreamToolWindowProvider.ShowToolWindow();

            return System.Threading.Tasks.Task.CompletedTask;
        }

        private void SetText(OleMenuCommand sender)
        {
            sender.Text = _sessionService.IsReady ? "CodeStream: Sign Out" : "CodeStream: Sign In";
        }
    }
}