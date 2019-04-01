using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Serilog;
using Serilog.Configuration;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting;
using Serilog.Formatting.Display;
using System;
using System.IO;

namespace CodeStream.VisualStudio.Core.Logging {
	internal class CustomOutputPaneSink : ILogEventSink {
		private readonly ITextFormatter _textFormatter;
		private readonly IVsOutputWindowPane _customOutputWindowPane;

		public CustomOutputPaneSink(Guid id, string title, ITextFormatter textFormatter) {
			try {
				if (id == Guid.Empty) throw new ArgumentException(nameof(id));
				if (title.IsNullOrWhiteSpace()) throw new ArgumentNullException(nameof(title));
				_textFormatter = textFormatter ?? throw new ArgumentNullException(nameof(textFormatter));				

				var outWindow = Package.GetGlobalService(typeof(SVsOutputWindow)) as IVsOutputWindow;				
				outWindow.CreatePane(ref id, title, 1, 1);
				outWindow.GetPane(ref id, out _customOutputWindowPane);
#if DEBUG
				// Brings this pane into view
				_customOutputWindowPane.Activate();
#endif
			}
			catch (Exception ex) {
				System.Diagnostics.Debug.WriteLine(ex.ToString());
			}
		}

		public void Emit(LogEvent logEvent) {
			if (logEvent == null) return;

			try {
				var stringWriter = new StringWriter();
				_textFormatter.Format(logEvent, stringWriter);

				_customOutputWindowPane.OutputString(stringWriter.ToString().Trim()+Environment.NewLine);
			}
			catch (Exception ex) {
				System.Diagnostics.Debug.WriteLine(ex.ToString());
			}
		}
	}

	internal static class CustomOutputPaneSinkConfigurationExtensions {
		const string DefaultOutputTemplate = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level}] {Message}{NewLine}{Exception}";

		/// <summary>
		/// Write log events to a CustomOutput in VisualStudio.
		/// </summary>
		/// <param name="sinkConfiguration">Logger sink configuration.</param>
		/// <param name="restrictedToMinimumLevel">The minimum level for
		/// events passed through the sink. Ignored when <paramref name="levelSwitch"/> is specified.</param>
		/// <param name="levelSwitch">A switch allowing the pass-through minimum level
		/// to be changed at runtime.</param>
		/// <param name="outputTemplate">A message template describing the format used to write to the sink.
		/// the default is "{Timestamp} [{Level}] {Message}{NewLine}{Exception}".</param>
		/// <param name="formatProvider">Supplies culture-specific formatting information, or null.</param>
		/// <returns>Configuration object allowing method chaining.</returns>
		public static LoggerConfiguration CustomOutput(
			this LoggerSinkConfiguration sinkConfiguration,
			Guid id,
			string title,
			LogEventLevel restrictedToMinimumLevel = LevelAlias.Minimum,
			string outputTemplate = DefaultOutputTemplate,
			IFormatProvider formatProvider = null,
			LoggingLevelSwitch levelSwitch = null) {
			if (sinkConfiguration == null) throw new ArgumentNullException(nameof(sinkConfiguration));
			if (outputTemplate == null) throw new ArgumentNullException(nameof(outputTemplate));
			var formatter = new MessageTemplateTextFormatter(outputTemplate, formatProvider);

			return CustomOutput(sinkConfiguration, id, title, formatter, restrictedToMinimumLevel, levelSwitch);
		}

		/// <summary>
		/// Write log events to a CustomOutput in VisualStudio.
		/// </summary>
		/// <param name="sinkConfiguration">Logger sink configuration.</param>
		/// <param name="restrictedToMinimumLevel">The minimum level for
		/// events passed through the sink. Ignored when <paramref name="levelSwitch"/> is specified.</param>
		/// <param name="levelSwitch">A switch allowing the pass-through minimum level
		/// to be changed at runtime.</param>
		/// <param name="formatter">A custom formatter to apply to the output events. This can be used with
		/// e.g. <see cref="JsonFormatter"/> to produce JSON output. To customize the text layout only, use the
		/// overload that accepts an output template instead.</param>
		/// <returns>Configuration object allowing method chaining.</returns>
		public static LoggerConfiguration CustomOutput(
			this LoggerSinkConfiguration sinkConfiguration,
			Guid id,
			string title,
			ITextFormatter formatter,
			LogEventLevel restrictedToMinimumLevel = LevelAlias.Minimum,
			LoggingLevelSwitch levelSwitch = null) {
			if (sinkConfiguration == null) throw new ArgumentNullException(nameof(sinkConfiguration));
			if (formatter == null) throw new ArgumentNullException(nameof(formatter));

			return sinkConfiguration.Sink(new CustomOutputPaneSink(id, title, formatter), restrictedToMinimumLevel, levelSwitch);
		}
	}
}
