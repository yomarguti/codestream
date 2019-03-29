using System;
using System.Windows.Threading;

namespace CodeStream.VisualStudio.Core {
	public class DebounceDispatcher {
		private DispatcherTimer _timer;

		/// <summary>
		/// Debounce an event by resetting the event timeout every time the event is 
		/// fired. The behavior is that the Action passed is fired only after events
		/// stop firing for the given timeout period.
		/// 
		/// Use Debounce when you want events to fire only after events stop firing
		/// after the given interval timeout period.
		/// 
		/// Wrap the logic you would normally use in your event code into
		/// the  Action you pass to this method to debounce the event.
		/// Example: https://gist.github.com/RickStrahl/0519b678f3294e27891f4d4f0608519a
		/// </summary>
		/// <param name="interval">Timeout in Milliseconds</param>
		/// <param name="action">Action<object> to fire when debounced event fires</object></param>
		/// <param name="param">optional parameter</param>
		/// <param name="priority">optional priorty for the dispatcher</param>
		/// <param name="disp">optional dispatcher. If not passed or null CurrentDispatcher is used.</param>        
		public void Debounce(int interval, Action<object> action,
			object param = null,
			DispatcherPriority priority = DispatcherPriority.ApplicationIdle,
			Dispatcher disp = null) {
			// kill pending timer and pending ticks
			_timer?.Stop();
			_timer = null;

			if (disp == null)
				disp = Dispatcher.CurrentDispatcher;

			// timer is recreated for each event and effectively
			// resets the timeout. Action only fires after timeout has fully
			// elapsed without other events firing in between
			_timer = new DispatcherTimer(TimeSpan.FromMilliseconds(interval), priority, (s, e) => {
				if (_timer == null)
					return;

				_timer?.Stop();
				_timer = null;
				action.Invoke(param);
			}, disp);

			_timer.Start();
		}
	}
}
