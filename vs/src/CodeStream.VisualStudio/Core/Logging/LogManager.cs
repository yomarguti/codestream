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
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;


namespace CodeStream.VisualStudio.Core.Logging {
	public static class LogManager {
#if DEBUG
		private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Verbose;
#else
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Warning;
#endif

		private static LoggingLevelSwitch _loggingLevelSwitch;
		private static ILogger CreateLogger() {
			try {
				var packageSettings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
				if (packageSettings != null && packageSettings.TraceLevel != TraceLevel.Silent) {
					_defaultLoggingLevel = FromTraceLevel(packageSettings.TraceLevel);
				}

				_loggingLevelSwitch = new LoggingLevelSwitch(_defaultLoggingLevel);

				var logPath = Path.Combine(Application.LogPath, "vs-extension.log");

				var template = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{ProcessId:00000}] {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}";
#if DEBUG
				// day/month/year and processId just aren't that important when developing -- they take up space
				template =
					"{Timestamp:HH:mm:ss.fff} {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}";
#endif

				return new LoggerConfiguration()
					.Enrich.WithProcessId()
					.Enrich.WithThreadId()
					.MinimumLevel.ControlledBy(_loggingLevelSwitch)
					.WriteTo.File(
						new LogSanitizingFormatter(
							new TextProcessor(),
							new List<ISanitizingFormatRule> { new SecretsSanitizingFormatRule() },
							new MessageTemplateTextFormatter(template, new CultureInfo("en-US"))),
						logPath,
						fileSizeLimitBytes: 52428800,
						shared: true)
					.WriteTo.CustomOutput(Guids.LoggingOutputPaneGuid, "CodeStream", outputTemplate: template, levelSwitch: _loggingLevelSwitch)
					.CreateLogger();
			}
			catch (Exception ex) {
#if DEBUG
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
			var logEventLevel = FromTraceLevel(level);
			if (_loggingLevelSwitch.MinimumLevel != logEventLevel) {
				ForContext(typeof(LogManager)).Information("Set Logging Level: {LogEventLevel}", logEventLevel);
				_loggingLevelSwitch.MinimumLevel = logEventLevel;
			}
		}

		static Lazy<ILogger> Logger { get; } = new Lazy<ILogger>(CreateLogger, false);

		[SuppressMessage("Microsoft.Design", "CA1004:GenericMethodsShouldProvideTypeParameter")]
		public static ILogger ForContext<T>() => ForContext(typeof(T));

		public static ILogger ForContext(Type type) => Logger.Value.ForContext(type).ForContext("ShortSourceContext", type.Name);
	}
}
