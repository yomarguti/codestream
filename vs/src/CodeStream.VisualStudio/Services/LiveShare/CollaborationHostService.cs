using CodeStream.VisualStudio.Events;
using Microsoft.VisualStudio.LiveShare;
using Microsoft.VisualStudio.Shell;
using System;

namespace CodeStream.VisualStudio.Services.LiveShare
{
    /// <summary>
    /// Just a marker interface
    /// </summary>
    public interface ICollaborationHostService
    {

    }

    public class CollaborationHostService : ICollaborationHostService, ICollaborationService, IDisposable
    {
        public CollaborationHostService(CollaborationSession collaborationSession, IEventAggregator eventAggregator)
        {
            eventAggregator.Publish(new LiveShareStartedEvent(collaborationSession));
        }

        private bool _disposed = false;

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
                return;

            if (disposing)
            {
                // slight HACK to clear out the current live share url once the live share has ended
                var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
                if (sessionService != null)
                {
                    sessionService.LiveShareUrl = null;
                }
            }

            _disposed = true;
        }
    }
}