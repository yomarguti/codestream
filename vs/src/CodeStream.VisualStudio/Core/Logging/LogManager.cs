using CodeStream.VisualStudio.Core.Logging.Sanitizer;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Display;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;

namespace CodeStream.VisualStudio.Core.Logging
{
    public static class LogManager
    {
#if DEBUG
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Debug;
#else
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Verbose;
#endif

        private static readonly LoggingLevelSwitch LoggingLevelSwitch = new LoggingLevelSwitch(_defaultLoggingLevel);

        static Logger CreateLogger()
        {
            var packageSettings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
            if (packageSettings != null && packageSettings.TraceLevel != TraceLevel.Silent)
            {
                _defaultLoggingLevel = FromTraceLevel(packageSettings.TraceLevel);
            }

            var logPath = Path.Combine(Application.LogPath, "vs-extension.log");

            var formatter = new MessageTemplateTextFormatter("{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{ProcessId:00000}] {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}",
                new CultureInfo("en-US"));

            return new LoggerConfiguration()
                 .Enrich.WithProcessId()
                  .Enrich.WithThreadId()
                .MinimumLevel.ControlledBy(LoggingLevelSwitch)
                 .WriteTo.File(
                     new LogSanitizingFormatter(
                         new TextProcessor(),
                         new List<ISanitizingFormatRule> { new SecretsSanitizingFormatRule() },
                         formatter),
                     logPath,
                     fileSizeLimitBytes: 52428800,
                     shared: true)
                .CreateLogger();
        }

        public static LogEventLevel FromTraceLevel(TraceLevel level)
        {
            if (level == TraceLevel.Errors) return LogEventLevel.Error;
            if (level == TraceLevel.Info) return LogEventLevel.Information;
            if (level == TraceLevel.Debug) return LogEventLevel.Debug;
            if (level == TraceLevel.Verbose) return LogEventLevel.Verbose;

            return LogEventLevel.Fatal;
        }

        public static void SetTraceLevel(TraceLevel level)
        {
            var logEventLevel = FromTraceLevel(level);
            if (LoggingLevelSwitch.MinimumLevel != logEventLevel)
            {
                ForContext(typeof(LogManager)).Information("Set Logging Level: {LogEventLevel}", logEventLevel);
                LoggingLevelSwitch.MinimumLevel = logEventLevel;
            }
        }

        static Lazy<Logger> Logger { get; } = new Lazy<Logger>(CreateLogger);

        [SuppressMessage("Microsoft.Design", "CA1004:GenericMethodsShouldProvideTypeParameter")]
        public static ILogger ForContext<T>() => ForContext(typeof(T));

        public static ILogger ForContext(Type type) => Logger.Value.ForContext(type).ForContext("ShortSourceContext", type.Name);
    }
}
