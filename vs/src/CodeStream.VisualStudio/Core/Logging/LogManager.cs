using Serilog;
using Serilog.Core;
using Serilog.Events;
using System;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;

namespace CodeStream.VisualStudio.Core.Logging
{
    public static class LogManager
    {
#if DEBUG
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Verbose;
#else
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Warning;
#endif

        private static readonly LoggingLevelSwitch LoggingLevelSwitch = new LoggingLevelSwitch(_defaultLoggingLevel);

        static Logger CreateLogger()
        {
            var packageSettings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;
            if (packageSettings?.TraceLevel != TraceLevel.Silent)
            {
                _defaultLoggingLevel = FromTraceLevel(packageSettings.TraceLevel);
            }

            var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Application.Name,
                "Logs",
                "vs-extension.log");

            const string outputTemplate =
                "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{ProcessId:00000}] {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}";

            return new LoggerConfiguration()
                 .Enrich.WithProcessId()
                  .Enrich.WithThreadId()
                .MinimumLevel.ControlledBy(LoggingLevelSwitch)
                .WriteTo.File(logPath,
                    fileSizeLimitBytes: 52428800,
                    outputTemplate: outputTemplate,
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
