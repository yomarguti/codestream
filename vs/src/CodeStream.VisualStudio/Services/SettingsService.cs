using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI.Settings;
using System;
using System.ComponentModel.Composition;
using Microsoft.VisualStudio.Shell;
using Serilog;
using CodeStream.VisualStudio.Core;

namespace CodeStream.VisualStudio.Services {
	public interface ISettingsServiceFactory {
		ISettingsService Create();
	}

	[Export(typeof(ISettingsServiceFactory))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class SettingsServiceFactory : ServiceFactory<ISettingsService>, ISettingsServiceFactory {
		private static readonly ILogger Log = LogManager.ForContext<SettingsServiceFactory>();

		[ImportingConstructor]
		public SettingsServiceFactory([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) :
			base(serviceProvider) {
		}

		public override ISettingsService Create() {
			try {
				return base.Create();
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(Create));
				throw;
			}
		}
	}

	public interface ISettingsService : IOptions {
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

	public class Settings {
		public IOptions Options { get; set; }
		/// <summary>
		/// this is solely the environment name (prod, pd, foo)
		/// </summary>
		public string Env { get; set; }
		/// <summary>
		/// this is the full formatted version
		/// </summary>
		public string Version { get; set; }
	}

	[Export(typeof(ISettingsService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class SettingsService : ISettingsService, IOptions {

		// once we don't support VS 2017, we'll be able to use something like...
		// the _lazy.GetValue() method only exists on the v16.0 version of MS.VS.Threading assembly

		//private readonly AsyncLazy<IOptionsDialogPage> _lazy = new AsyncLazy<IOptionsDialogPage>(async () => {			
		//	var dialogPage = await OptionsDialogPage.GetLiveInstanceAsync();			
		//	return dialogPage;
		//}, ThreadHelper.JoinableTaskFactory);

		private IOptionsDialogPage _dialogPage;
		private static readonly object locker = new object();

		public IOptionsDialogPage DialogPage {
			get {
				lock (locker) {
					if (_dialogPage == null) {
						ThreadHelper.JoinableTaskFactory.Run(async delegate {
							_dialogPage = await OptionsDialogPage.GetLiveInstanceAsync();
						});
					}
				}
				return _dialogPage;
			}
		}

		[ImportingConstructor]
		public SettingsService() { }


		public void SaveSettingsToStorage() {
			DialogPage.Save();
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
			get => DialogPage.ServerUrl;
			set => DialogPage.ServerUrl = value;
		}

		public string WebAppUrl {
			get => DialogPage.WebAppUrl;
			set => DialogPage.WebAppUrl = value;
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

	public class SettingsScope : IDisposable {
		public ISettingsService SettingsService { get; private set; }

		private SettingsScope(ISettingsService settingsService) {
			SettingsService = settingsService;
		}

		private bool _disposed;

		public void Dispose() {
			Dispose(true);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed) return;

			if (disposing) {
				SettingsService?.SaveSettingsToStorage();
			}

			_disposed = true;
		}

		public static SettingsScope Create(ISettingsService settingsService) {
			return new SettingsScope(settingsService);
		}
	}
}
