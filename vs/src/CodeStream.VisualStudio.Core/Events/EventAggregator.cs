using System;

namespace CodeStream.VisualStudio.Core.Events {
	public interface IEventAggregator {
		void Publish<TEvent>(TEvent sampleEvent) where TEvent : EventBase;
		IObservable<TEvent> GetEvent<TEvent>() where TEvent : EventBase;
	}	 
}
