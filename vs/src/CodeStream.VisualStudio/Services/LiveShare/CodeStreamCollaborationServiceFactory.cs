using System;
using System.ComponentModel.Composition;
using System.Threading;
using CodeStream.VisualStudio.Events;
using Microsoft.VisualStudio.LiveShare;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Services.LiveShare
{
    /// <summary>
    /// See https://www.nuget.org/packages/Microsoft.VisualStudio.LiveShare/
    /// </summary>
    [ExportCollaborationService(typeof(ICodeStreamHostCollaborationService),
        Name = "CodeStreamLS",
        Scope = SessionScope.Host,
        Role = ServiceRole.RemoteService
    )]
    public class CodeStreamCollaborationServiceFactory : ICollaborationServiceFactory
    {
        private readonly IEventAggregator _eventAggregator;

        [ImportingConstructor]
        public CodeStreamCollaborationServiceFactory()
        {
            _eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
        }

        public System.Threading.Tasks.Task<ICollaborationService> CreateServiceAsync(
            CollaborationSession collaborationSession, CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult<ICollaborationService>(new CodeStreamCollaborationHostService(collaborationSession, _eventAggregator));
        }
    }
}