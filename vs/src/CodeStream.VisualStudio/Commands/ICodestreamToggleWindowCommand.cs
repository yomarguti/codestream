using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Input;

namespace CodeStream.VisualStudio.Commands
{
    /// <summary>
    /// Represents a Visual Studio command that does not accept a parameter.
    /// </summary>
    public interface IVsCommand : IVsCommandBase
    {
        /// <summary>
        /// Executes the command.
        /// </summary>
        /// <returns>A task that tracks the execution of the command.</returns>
        Task Execute();
    }

    /// <summary>
    /// Represents a Visual Studio command that accepts a parameter.
    /// </summary>
    public interface IVsCommand<TParam> : IVsCommandBase
    {
        /// <summary>
        /// Executes the command.
        /// </summary>
        /// <param name="parameter">The command parameter.</param>
        /// <returns>A task that tracks the execution of the command.</returns>
        Task Execute(TParam parameter);
    }

    public interface IVsCommandBase : ICommand
    {
        /// <summary>
        /// Gets a value indicating whether the command is enabled.
        /// </summary>
        bool Enabled { get; }

        /// <summary>
        /// Gets a value indicating whether the command is visible.
        /// </summary>
        bool Visible { get; }
    }

    public interface ICodestreamToggleWindowCommand : IVsCommand
    {
    }
}
