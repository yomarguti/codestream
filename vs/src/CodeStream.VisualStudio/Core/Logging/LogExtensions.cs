using CodeStream.VisualStudio.Extensions;
using Serilog;
using Serilog.Events;
using SerilogTimings.Extensions;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Core.Logging
{
    public static class LogExtensions
    {
        public static IDisposable CriticalOperation(this ILogger logger, string message, LogEventLevel minimumEventLevel = LogEventLevel.Verbose)
        {
            if (logger == null || !logger.IsEnabled(minimumEventLevel)) return null;

            return logger.TimeOperation(message);
        }       

        public static IDisposable CriticalOperation(this ILogger logger, Dictionary<string, object> message, LogEventLevel minimumEventLevel = LogEventLevel.Verbose)
        {
            if (logger == null || !logger.IsEnabled(minimumEventLevel)) return null;

            return logger.TimeOperation(message.ToKeyValueString());
        }

        static IDisposable TimeOperation(this ILogger log, string message)
        {
            return LoggerOperationExtensions.TimeOperation(log, message);
        }
    }
}
