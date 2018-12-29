using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Vssdk.Commands;

namespace CodeStream.VisualStudio.Commands
{
    [Export(typeof(ISignOutCommand))]
    public class SignOutCommand : VsCommand, ISignOutCommand
    {
        [ImportingConstructor]
        protected SignOutCommand()
            : base(CommandSet, CommandId)
        {
        }

        public static readonly Guid CommandSet = new Guid(Guids.SignOutCommandCmdSet);
        public const int CommandId = PkgCmdIDList.SignOutCommand;
        
        public override System.Threading.Tasks.Task Execute()
        {
            return System.Threading.Tasks.Task.CompletedTask;
        }
    }
}