using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using Serilog;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reactive.Linq;
using System.Reactive.Subjects;

namespace CodeStream.VisualStudio.Events
{
    public interface SEventAggregator { }

    public interface IEventAggregator
    {
        void Publish<TEvent>(TEvent sampleEvent) where TEvent : EventArgsBase;
        IObservable<TEvent> GetEvent<TEvent>() where TEvent : EventArgsBase;
        void Unregister(IDisposable disposable);
        void Unregister(List<IDisposable> disposables);
    }

    public class EventAggregator : IEventAggregator, SEventAggregator
    {
        private static readonly ILogger Log = LogManager.ForContext<EventAggregator>();

        private readonly ConcurrentDictionary<Type, object> _subjects
            = new ConcurrentDictionary<Type, object>();
#if DEBUG
        private readonly ConcurrentDictionary<Type, int> _publishStats = new ConcurrentDictionary<Type, int>();
#endif

        public IObservable<TEvent> GetEvent<TEvent>() where TEvent : EventArgsBase
        {
            var subject = (ISubject<TEvent>)_subjects.GetOrAdd(typeof(TEvent),
                            t => new Subject<TEvent>());

#if DEBUG
            Log.Verbose($"Subscribed to {typeof(TEvent)}");
#endif
            return subject.AsObservable();
        }

        public void Publish<TEvent>(TEvent sampleEvent) where TEvent : EventArgsBase
        {
            if (_subjects.TryGetValue(typeof(TEvent), out var subject))
            {
#if DEBUG
                _publishStats.AddOrUpdate(typeof(TEvent), 1, (type, i) => i + 1);
                if (_publishStats.TryGetValue(typeof(TEvent), out int count))
                {
                    if (count % 10 == 0)
                    {
                        Log.Verbose($"Published {typeof(TEvent)} {count} times");
                    }
                }
#endif

                ((ISubject<TEvent>)subject).OnNext(sampleEvent);
            }
        }

        public void Unregister(IDisposable  disposable)
        {
            if (disposable == null) return;

            disposable.Dispose();
#if DEBUG
            Log.Verbose($"Unregistered {disposable.GetType()}");
#endif
        }

        public void Unregister(List<IDisposable> disposables)
        {
            if (!disposables.AnySafe()) return;

            foreach(var disposable in disposables)
            {
                Unregister(disposable);
            }
        }
    }
}
