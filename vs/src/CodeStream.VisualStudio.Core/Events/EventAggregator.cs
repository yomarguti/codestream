using System;
#if DEBUG
using System.Runtime.CompilerServices;
#endif

namespace CodeStream.VisualStudio.Core.Events {
	public interface IEventAggregator {
		void Publish<TEvent>(TEvent @event
#if DEBUG
	, [CallerFilePath] string callerFilePath = "",
	[CallerLineNumber] long callerLineNumber = 0,
	[CallerMemberName] string callerMember = ""
#endif

			) where TEvent : EventBase;
		IObservable<TEvent> GetEvent<TEvent>(
#if DEBUG
			[CallerFilePath] string callerFilePath = "",
	[CallerLineNumber] long callerLineNumber = 0,
	[CallerMemberName] string callerMember = ""
#endif
			) where TEvent : EventBase;
	}	 
}
