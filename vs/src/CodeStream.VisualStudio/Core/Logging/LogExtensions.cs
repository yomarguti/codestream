using CodeStream.VisualStudio.Extensions;
using Serilog;
using Serilog.Events;
using SerilogTimings.Extensions;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Core.Logging {
	public static class LogExtensions {
		public static IDisposable CriticalOperation(this ILogger logger, string message, LogEventLevel logEventLevel = LogEventLevel.Verbose) {
			if (logger == null || !logger.IsEnabled(logEventLevel)) return null;

			return logger.TimeOperation(message, logEventLevel);
		}

		public static IDisposable CriticalOperation(this ILogger logger, Dictionary<string, object> message, LogEventLevel logEventLevel = LogEventLevel.Verbose) {
			if (logger == null || !logger.IsEnabled(logEventLevel)) return null;

			return logger.TimeOperation(message.ToKeyValueString(), logEventLevel);
		}

		static IDisposable TimeOperation(this ILogger log, string message, LogEventLevel logEventLevel = LogEventLevel.Verbose) {

			return log.OperationAt(logEventLevel).Time(message);
		}

		public static bool IsDebuggingEnabled(this ILogger log) => log.IsEnabled(LogEventLevel.Debug);

		public static bool IsVerboseEnabled(this ILogger log) => log.IsEnabled(LogEventLevel.Verbose);
	}	
}
