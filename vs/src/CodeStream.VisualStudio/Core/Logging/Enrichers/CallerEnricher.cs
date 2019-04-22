using Serilog;
using Serilog.Configuration;
using Serilog.Core;
using Serilog.Events;
using System.Diagnostics;
using System.Linq;

namespace CodeStream.VisualStudio.Core.Logging.Enrichers {
	//yanked from https://gist.github.com/nblumhardt/0e1e22f50fe79de60ad257f77653c813

	internal static class LoggerCallerEnrichmentConfiguration {
		public static LoggerConfiguration WithCaller(this LoggerEnrichmentConfiguration enrichmentConfiguration) {
			return enrichmentConfiguration.With<CallerEnricher>();
		}
	}

	internal class CallerEnricher : ILogEventEnricher {
		public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory) {
			var skip = 3;
			while (true) {
				var stack = new StackFrame(skip);
				if (!stack.HasMethod()) {
					logEvent.AddPropertyIfAbsent(new LogEventProperty("Caller", new ScalarValue("<unknown method>")));
					return;
				}

				var method = stack.GetMethod();
				if (method.DeclaringType != null && method.DeclaringType.FullName != "SerilogTimings.Operation"
				                                 && method.DeclaringType.Assembly != typeof(Log).Assembly) {
					var caller = $"{method.DeclaringType.FullName}.{method.Name}({string.Join(", ", method.GetParameters().Select(pi => pi.ParameterType.FullName))})";
					logEvent.AddPropertyIfAbsent(new LogEventProperty("Caller", new ScalarValue(caller)));
				}

				skip++;
			}
		}
	}
}
