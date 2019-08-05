using Microsoft.VisualStudio.LiveShare;
using Microsoft.VisualStudio.Shell;
using System;
using CodeStream.VisualStudio.Core.Events;
using CodeStream.VisualStudio.Core.Services;
using Microsoft.VisualStudio.ComponentModelHost;

namespace CodeStream.VisualStudio.Services.LiveShare {
	/// <summary>
	/// Just a marker interface
	/// </summary>
	public interface ICollaborationHostService {}

	public class CollaborationHostService : ICollaborationHostService, ICollaborationService, IDisposable {
		public CollaborationHostService(CollaborationSession collaborationSession, IEventAggregator eventAggregator) {
			eventAggregator.Publish(new LiveShareStartedEvent(collaborationSession));
		}

		private bool _disposed = false;

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed)
				return;

			if (disposing) {
				// slight HACK to clear out the current live share url once the live share has ended
				var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
				var sessionService = componentModel?.GetService<ISessionService>();

				if (sessionService != null) {
					sessionService.LiveShareUrl = null;
				}
			}

			_disposed = true;
		}
	}
}
