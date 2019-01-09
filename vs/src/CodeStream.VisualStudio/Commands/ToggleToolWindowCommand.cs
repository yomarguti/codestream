using CodeStream.VisualStudio.Vssdk.Commands;
using System;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.Commands
{
    [Export(typeof(IToggleToolWindowCommand))]
    public class ToggleToolWindowCommand : VsCommand, IToggleToolWindowCommand
    {
        private readonly IToolWindowProvider _toolWindowProvider;

        [ImportingConstructor]
        protected ToggleToolWindowCommand(IToolWindowProvider provider)
            : base(CommandSet, CommandId)
        {
            _toolWindowProvider = provider;
        }

        public static readonly Guid CommandSet = new Guid(Guids.ToggleToolWindowCommandCmdSet);

        public const int CommandId = PkgCmdIdList.ToggleToolWindowCommand;

        public override System.Threading.Tasks.Task ExecuteAsync()
        {
            _toolWindowProvider.ToggleToolWindowVisibility(Guids.WebViewToolWindowGuid);

            return System.Threading.Tasks.Task.CompletedTask;
        }
    }
}