using System;
using System.Collections.Generic;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Serilog;
using Serilog.Events;

namespace CodeStream.VisualStudio
{
    internal class IpcLogger
    {        
        public static IDisposable CriticalOperation(ILogger log, string name, IAbstractMessageType message)
        {
            if (log == null || !log.IsEnabled(LogEventLevel.Verbose)) return null;

            var result = new Dictionary<string, object> {{nameof(name), name}};
            if (!message.Id.IsNullOrWhiteSpace())
            {
                result.Add(nameof(message.Id), message.Id);
            }
            if (!message.Method.IsNullOrWhiteSpace())
            {
                result.Add(nameof(message.Method), message.Method);
            }
            if (!message.Error.IsNullOrWhiteSpace())
            {
                result.Add(nameof(message.Error), message.Error);
            }

            return log.CriticalOperation(result);
        }
    }
}