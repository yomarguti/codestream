using Serilog;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace CodeStream.VisualStudio.Core.Logging.Instrumentation {
	public class Metrics : IDisposable {
		private readonly ILogger _logger;
		private readonly string _message;
		public Stopwatch Stopwatch { get; }
		public List<Metric> Data { get; private set; }		

		/// <summary>
		/// Disposable class that writes all entries to a single log entry on dispose
		/// </summary>
		/// <param name="logger"></param>
		/// <param name="message"></param>
		public Metrics(ILogger logger, string message) {
			_logger = logger;
			_message = message;
			Data = new List<Metric>();
			Stopwatch = new Stopwatch();
			Stopwatch.Start();
		}

		public void Dispose() {
			Stopwatch.Stop();
			_logger.Verbose(
				Environment.NewLine +
				string.Join(Environment.NewLine, Data.Select(pair => $"-->{pair.Message} ({pair.Milliseconds}ms)").ToArray())
				+ Environment.NewLine +
				_message + " completed in " + Stopwatch.Elapsed.TotalMilliseconds + "ms");
		}
	}

	public class MeasureDisposer : IDisposable {
		private readonly List<Metric> _metrics;
		private readonly Metric _metric;

		public MeasureDisposer(List<Metric> metrics, Metric metric) {
			_metrics = metrics;
			_metric = metric;
		}
		public void Dispose() {
			var elapsed = _metric.GetElapsed();
			_metric.Ticks = elapsed.Ticks;
			_metric.Milliseconds = elapsed.TotalMilliseconds;
			_metrics.Add(_metric);
		}
	}

	public class Metric {
		private Stopwatch _stopwatch;
		public Metric(string message) {
			Message = message;
			_stopwatch = new Stopwatch();
			_stopwatch.Start();
		}

		/// <summary>
		/// Stops the stopwatch and returns the elapsed timespan
		/// </summary>
		/// <returns></returns>
		public TimeSpan GetElapsed() {
			_stopwatch.Stop();
			return _stopwatch.Elapsed;
		}

		public string Message { get; }
		public long Ticks { get; set; }
		public double Milliseconds { get; set; }
		public long ElapsedTicks { get; set; }
	}
}
