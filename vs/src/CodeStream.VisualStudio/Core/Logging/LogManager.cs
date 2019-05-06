#if DEBUG
using CodeStream.VisualStudio.Core.Logging.Enrichers;
#endif
using CodeStream.VisualStudio.Core.Logging.Sanitizer;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Display;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Threading;

namespace CodeStream.VisualStudio.Core.Logging {
	public static class LogManager {
#if DEBUG
		private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Debug;
#else
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Information;
#endif

		private static readonly LoggingLevelSwitch _loggingLevelSwitch = new LoggingLevelSwitch(_defaultLoggingLevel);
		private static ILogger CreateLogger() {
			try {
				var logPath = Path.Combine(Application.LogPath, "vs-extension.log");
				var template = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{ProcessId:00000}] {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}";
#if DEBUG
				// day/month/year and processId just aren't that important when developing -- they take up space
				template =
					"{Timestamp:HH:mm:ss.fff} {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}(at {Caller}){NewLine}{Exception}";
#endif

				return new LoggerConfiguration()
					.Enrich.WithProcessId()
					.Enrich.WithThreadId()
#if DEBUG
					.Enrich.WithCaller()
#endif
					.MinimumLevel.ControlledBy(_loggingLevelSwitch)
					.WriteTo.File(
						new LogSanitizingFormatter(
							new TextProcessor(),
							new List<ISanitizingFormatRule> { new SecretsSanitizingFormatRule() },
							new MessageTemplateTextFormatter(template, new CultureInfo("en-US"))),
						logPath,
						fileSizeLimitBytes: 52428800,
						shared: true)
						// this can cause performance issues if used at Verbose mode
					.WriteTo.CustomOutput(Guids.LoggingOutputPaneGuid, "CodeStream", outputTemplate: template, restrictedToMinimumLevel : LogEventLevel.Error)
					.CreateLogger();
			}
			catch (Exception ex) {
#if DEBUG
				System.Diagnostics.Debug.WriteLine(ex);
				System.Diagnostics.Debugger.Break();
#endif
				return new EmptyLogger();
			}
		}

		public static LogEventLevel FromTraceLevel(TraceLevel level) {
			if (level == TraceLevel.Errors) return LogEventLevel.Error;
			if (level == TraceLevel.Info) return LogEventLevel.Information;
			if (level == TraceLevel.Debug) return LogEventLevel.Debug;
			if (level == TraceLevel.Verbose) return LogEventLevel.Verbose;

			return LogEventLevel.Fatal;
		}

		public static void SetTraceLevel(TraceLevel level) {
			try {
				var logEventLevel = FromTraceLevel(level);
				if (_loggingLevelSwitch.MinimumLevel != logEventLevel) {
					ForContext(typeof(LogManager)).Information("Set Logging Level: {LogEventLevel}", logEventLevel);
					_loggingLevelSwitch.MinimumLevel = logEventLevel;
				}
			}
			catch {
				//suffer
			}
		}

		static Lazy<ILogger> Logger { get; } = new Lazy<ILogger>(() => {
			try {
				return CreateLogger();
			}
			catch (Exception ex) {
#if DEBUG
				System.Diagnostics.Debug.WriteLine(ex);
				System.Diagnostics.Debugger.Break();
#endif
				return new EmptyLogger();
			}
		}, LazyThreadSafetyMode.ExecutionAndPublication);

		[SuppressMessage("Microsoft.Design", "CA1004:GenericMethodsShouldProvideTypeParameter")]
		public static ILogger ForContext<T>() {
			try {
				return ForContext(typeof(T));
			}
			catch (Exception ex) {
#if DEBUG
				System.Diagnostics.Debug.WriteLine(ex);
				System.Diagnostics.Debugger.Break();
#endif
				return new EmptyLogger();
			}
		}

		public static ILogger ForContext(Type type) {
			try {
				return Logger.Value.ForContext(type).ForContext("ShortSourceContext", type.Name);
			}
			catch (Exception ex) {
#if DEBUG
				System.Diagnostics.Debug.WriteLine(ex);
				System.Diagnostics.Debugger.Break();
#endif
				return new EmptyLogger();
			}
		}
	}
}
