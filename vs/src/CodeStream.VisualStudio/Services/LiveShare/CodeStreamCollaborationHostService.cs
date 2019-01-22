using CodeStream.VisualStudio.Events;
using Microsoft.VisualStudio.LiveShare;
using Microsoft.VisualStudio.Shell;
using System;

namespace CodeStream.VisualStudio.Services.LiveShare
{
    public interface ICodeStreamHostCollaborationService
    {

    }

    public class CodeStreamCollaborationHostService : ICodeStreamHostCollaborationService, ICollaborationService, IDisposable
    {
        public CodeStreamCollaborationHostService(CollaborationSession collaborationSession, IEventAggregator eventAggregator)
        {
            eventAggregator.Publish(new LiveShareStartedEvent(collaborationSession));
        }

        bool disposed = false;

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (disposed)
                return;

            if (disposing)
            {
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                if (sessionService != null)
                {
                    sessionService.LiveShareUrl = null;
                }
            }

            disposed = true;
        }
    }
}