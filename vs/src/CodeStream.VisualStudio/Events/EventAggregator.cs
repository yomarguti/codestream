using System;
using System.Collections.Concurrent;
using System.Reactive.Linq;
using System.Reactive.Subjects;

namespace CodeStream.VisualStudio.Events
{
    public interface SEventAggregator
    {

    }

    public interface IEventAggregator
    {
        void Publish<TEvent>(TEvent sampleEvent) where TEvent : IEvent;
        IObservable<TEvent> GetEvent<TEvent>() where TEvent : IEvent;
    }

    public class EventAggregator : IEventAggregator, SEventAggregator
    {
        private readonly ConcurrentDictionary<Type, object> subjects
            = new ConcurrentDictionary<Type, object>();

        public IObservable<TEvent> GetEvent<TEvent>() where TEvent:IEvent
        {
            var subject = (ISubject<TEvent>)subjects.GetOrAdd(typeof(TEvent),
                            t => new Subject<TEvent>());
            return subject.AsObservable();
        }

        public void Publish<TEvent>(TEvent sampleEvent) where TEvent : IEvent
        {
            object subject;
            if (subjects.TryGetValue(typeof(TEvent), out subject))
            {
                ((ISubject<TEvent>)subject)
                    .OnNext(sampleEvent);
            }
        }
    }
}
