using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.Services {
	public interface ISettingsManager : IOptions {
		void SaveSettingsToStorage();
		Settings GetSettings();
		TraceLevel TraceLevel { get; set; }
		IOptionsDialogPage DialogPage { get; }
		string GetEnvironmentName();
		string GetUsefulEnvironmentName();
		string GetEnvironmentVersionFormatted();
		Ide GetIdeInfo();
		Extension GetExtensionInfo();
		Proxy Proxy { get; }
	}
}
