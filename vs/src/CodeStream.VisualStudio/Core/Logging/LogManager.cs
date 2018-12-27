using Serilog;
using Serilog.Core;
using Serilog.Events;
using System;
using System.Diagnostics.CodeAnalysis;
using System.IO;

namespace CodeStream.VisualStudio.Core.Logging
{
    public static class LogManager
    {
#if DEBUG
        private static LogEventLevel _defaultLoggingLevel = LogEventLevel.Debug;
#else
        private static LogEventLevel DefaultLoggingLevel = LogEventLevel.Warning;
#endif

        private static LoggingLevelSwitch _loggingLevelSwitch = new LoggingLevelSwitch(_defaultLoggingLevel);

        static Logger CreateLogger()
        {
            var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Application.Name,
                "Logs",
                "vs-extension.log");

            const string outputTemplate =
                "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{ProcessId:00000}] {Level:u4} [{ThreadId:00}] {ShortSourceContext,-25} {Message:lj}{NewLine}{Exception}";

            return new LoggerConfiguration()
                 .Enrich.WithProcessId()
                  .Enrich.WithThreadId()
                .MinimumLevel.ControlledBy(_loggingLevelSwitch)
                .WriteTo.File(logPath,
                    fileSizeLimitBytes: null,
                    outputTemplate: outputTemplate,
                    shared: true)
                .CreateLogger();
        }

        public static void EnableTraceLogging(bool enable)
        {
            var logEventLevel = enable ? LogEventLevel.Verbose : _defaultLoggingLevel;
            if (_loggingLevelSwitch.MinimumLevel != logEventLevel)
            {
                ForContext(typeof(LogManager)).Information("Set Logging Level: {LogEventLevel}", logEventLevel);
                _loggingLevelSwitch.MinimumLevel = logEventLevel;
            }
        }

        static Lazy<Logger> Logger { get; } = new Lazy<Logger>(CreateLogger);

        [SuppressMessage("Microsoft.Design", "CA1004:GenericMethodsShouldProvideTypeParameter")]
        public static ILogger ForContext<T>() => ForContext(typeof(T));

        public static ILogger ForContext(Type type) => Logger.Value.ForContext(type).ForContext("ShortSourceContext", type.Name);
    }
}
