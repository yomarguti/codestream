using System;

namespace CodeStream.VisualStudio.Core.Logging.Instrumentation {
	public static class MetricsExtensions {
		public static IDisposable Measure(this Metrics metrics, string message) {
			if (metrics == null) return null;

			return new MeasureDisposer(metrics.Data, new Metric(message));
		}

		//[Conditional("DEBUG")]
		//public static void Instrument(this Metrics metrics, string message) {
		//  TODO a single, non-wrapped point
		//}
	}
}
