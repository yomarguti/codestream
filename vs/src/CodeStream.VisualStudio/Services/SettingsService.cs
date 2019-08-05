using CodeStream.VisualStudio.Core.Logging;
using System;
using System.ComponentModel.Composition;
using Serilog;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Packages;
using CodeStream.VisualStudio.Core.Services;
using Microsoft.VisualStudio.Shell;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.UI.Settings;

namespace CodeStream.VisualStudio.Services {
	 

	[Export(typeof(ISettingsServiceFactory))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class SettingsServiceFactory : ISettingsServiceFactory {
		private static readonly ILogger Log = LogManager.ForContext<SettingsServiceFactory>();

		private volatile ISettingsManager _settingsManager = null;
		private static readonly object locker = new object();


		/// <summary>
		/// DO NOT call this in another constructor -- possible that SOptionsDialogPageAccessor has not been registered yet
		/// </summary>
		/// <returns></returns>
		public virtual ISettingsManager Create() {
			try {
				if (_settingsManager == null) {
					lock (locker) {
						if (_settingsManager == null) {
							ThreadHelper.ThrowIfNotOnUIThread();
							var accessor = Package.GetGlobalService(typeof(SOptionsDialogPageAccessor)) as IOptionsDialogPageAccessor;
							Microsoft.Assumes.Present(accessor);
							var result = new SettingsManager(accessor?.GetOptionsDialogPage());

							Log.Verbose($"{nameof(Create)} Initialized");
							_settingsManager = result;
						}
					}
				}

				Log.Verbose($"{nameof(Create)}d");
				return _settingsManager;
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(Create));
				throw;
			}
		}
	}

	 

	public class SettingsManager : ISettingsManager, IOptions {
		// once we don't support VS 2017, we'll be able to use something like...
		// the _lazy.GetValue() method only exists on the v16.0 version of MS.VS.Threading assembly

		//By using this your pain will be legendary, even in hell.
		//private readonly AsyncLazy<IOptionsDialogPage> _lazy = new AsyncLazy<IOptionsDialogPage>(async () => {
		//	var dialogPage = await OptionsDialogPage.GetLiveInstanceAsync();
		//	return dialogPage;
		//}, ThreadHelper.JoinableTaskFactory);

		//By using this your pain will be legendary, even in hell.
		//public async System.Threading.Tasks.Task InitializeAsync() {
		//	DialogPage = await OptionsDialogPage.GetLiveInstanceAsync();
		//}

		public SettingsManager(IOptionsDialogPage dialogPage) {
			DialogPage = dialogPage;
			DialogPage.LoadSettingsFromStorage();
		}

		public IOptionsDialogPage DialogPage { get; private set; }

		public SettingsManager() { }


		public void SaveSettingsToStorage() {
			DialogPage.SaveSettingsToStorage();
		}

		public Settings GetSettings() {
			return new Settings {
				Options = this,
				Env = GetEnvironmentName(),
				Version = GetEnvironmentVersionFormatted()
			};
		}

		public string Email {
			get => DialogPage.Email;
			set => DialogPage.Email = value;
		}

		public bool ShowAvatars {
			get => DialogPage.ShowAvatars;
			set => DialogPage.ShowAvatars = value;
		}

		public string ServerUrl {
			get => DialogPage.ServerUrl.IsNullOrWhiteSpace() ? DialogPage.ServerUrl : DialogPage.ServerUrl.TrimEnd('/');
			set => DialogPage.ServerUrl = value.IsNullOrWhiteSpace() ? value : value.TrimEnd('/');
		}

		public string Team {
			get => DialogPage.Team;
			set => DialogPage.Team = value;
		}

		public bool ShowMarkerGlyphs {
			get => DialogPage.ShowMarkerGlyphs;
			set => DialogPage.ShowMarkerGlyphs = value;
		}

		public TraceLevel TraceLevel {
			get {
				return DialogPage.TraceLevel;
			}
			set {
				DialogPage.TraceLevel = value;
			}
		}

		public bool AutoSignIn {
			get => DialogPage.AutoSignIn;
			set => DialogPage.AutoSignIn = value;
		}

		public bool AutoHideMarkers {
			get => DialogPage.AutoHideMarkers;
			set => DialogPage.AutoHideMarkers = value;
		}

		public string ProxyUrl {
			get => DialogPage.ProxyUrl;
			set => DialogPage.ProxyUrl = value;
		}

		public bool ProxyStrictSsl {
			get => DialogPage.ProxyStrictSsl;
			set => DialogPage.ProxyStrictSsl = value;
		}

		public ProxySupport ProxySupport {
			get => DialogPage.ProxySupport;
			set => DialogPage.ProxySupport = value;
		}

		public Proxy Proxy => DialogPage.Proxy;

		public Ide GetIdeInfo() {
			return new Ide {
				Name = Application.IdeMoniker,
				Version = Application.VisualStudioVersionString
			};
		}

		public Extension GetExtensionInfo() {
			return new Extension {
				Version = Application.ExtensionVersionShort.ToString(),
				VersionFormatted = GetEnvironmentVersionFormatted(),
				Build = Application.BuildNumber.ToString(),
				BuildEnv = Application.BuildEnv
			};
		}

		/// <summary>
		/// This is the environment dictated by the urls the user is using
		/// </summary>
		/// <returns></returns>
		public string GetEnvironmentName() {
			if (ServerUrl == null) return "unknown";

			var match = RegularExpressions.EnvironmentRegex.Match(ServerUrl);
			if (!match.Success) return "unknown";

			if (match.Groups[1].Value.EqualsIgnoreCase("localhost")) {
				return "local";
			}

			if (match.Groups[2].Value.IsNullOrWhiteSpace()) {
				return "prod";
			}

			return match.Groups[2].Value.ToLowerInvariant();
		}

		public string GetUsefulEnvironmentName() {
			var envName = GetEnvironmentName();
			switch (envName) {
				case "unknown":
				case "local":
				case "prod":
					return null;
				default:
					return envName.ToUpperInvariant();
			}
		}

		public string GetEnvironmentVersionFormatted() {
			var environmentName = GetEnvironmentName();
			return $"{Application.ExtensionVersionSemVer}{(environmentName != "prod" ? " (" + environmentName + ")" : "")}";
		}
	}
}
