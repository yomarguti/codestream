using CodeStream.VisualStudio.Core.Logging;
using Serilog;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Text;
using System.Threading.Tasks;
using CodeStream.VisualStudio.Core.Events;

namespace CodeStream.VisualStudio.Services {
	[Export(typeof(IEventAggregator))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class EventAggregator : IEventAggregator {
		private static readonly ILogger Log = LogManager.ForContext<EventAggregator>();

		private readonly ConcurrentDictionary<Type, object> _subjects = new ConcurrentDictionary<Type, object>();

		public IObservable<TEvent> GetEvent<TEvent>() where TEvent : EventBase {
			var subject = (ISubject<TEvent>)_subjects.GetOrAdd(typeof(TEvent),
							t => new Subject<TEvent>());

			Log.Debug($"Subscribed={typeof(TEvent)}");
			return subject.AsObservable();
		}

		public void Publish<TEvent>(TEvent sampleEvent) where TEvent : EventBase {
			if (_subjects.TryGetValue(typeof(TEvent), out var subject)) {
				Log.Debug($"Published={typeof(TEvent)}");

				((ISubject<TEvent>)subject).OnNext(sampleEvent);
			}
			else {
				Log.LocalWarning($"Event Not Found={typeof(TEvent)}");
			}
		}
	}
}
