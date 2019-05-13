using System;
using System.Reactive.Linq;

namespace CodeStream.VisualStudio.Extensions {
	public static class ReactiveExtensions {
		public static IObservable<T> ObserveOnApplicationDispatcher<T>(this IObservable<T> observable) {
			return observable?.ObserveOn(System.Windows.Application.Current.Dispatcher);
		}
	}
}
