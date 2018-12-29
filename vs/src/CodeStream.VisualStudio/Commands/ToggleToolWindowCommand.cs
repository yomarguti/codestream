using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Vssdk.Commands;

namespace CodeStream.VisualStudio.Commands
{
    [Export(typeof(IToggleToolWindowCommand))]
    public class ToggleToolWindowCommand : VsCommand, IToggleToolWindowCommand
    {
        private readonly ICodeStreamServiceProvider _provider;

        [ImportingConstructor]
        protected ToggleToolWindowCommand(ICodeStreamServiceProvider provider)
            : base(CommandSet, CommandId)
        {
            _provider = provider;
        }

        public static readonly Guid CommandSet = new Guid(Guids.ToggleToolWindowCommandCmdSet);
        
        public const int CommandId = PkgCmdIDList.ToggleToolWindowCommand;

        public override System.Threading.Tasks.Task Execute()
        {
            _provider.ToggleToolWindowVisibility();

            return System.Threading.Tasks.Task.CompletedTask;
        }
    }
}