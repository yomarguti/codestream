using Microsoft.VisualStudio.Shell;
using System;

namespace CodeStream.VisualStudio.Commands
{
    public abstract class CommandBase
    {
        protected CommandBase(AsyncPackage package)
        {
            Package = package ?? throw new ArgumentNullException(nameof(package));
        }

        protected readonly AsyncPackage Package;

        /// <summary>
        /// Gets the service provider from the owner package.
        /// </summary>
        protected IAsyncServiceProvider ServiceProvider => Package;
    }
}
