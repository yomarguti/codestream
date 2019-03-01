using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using DotNetBrowser;
using DotNetBrowser.Events;
using DotNetBrowser.WPF;
using Newtonsoft.Json.Linq;
using Serilog;
using SerilogTimings.Extensions;
using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using static CodeStream.VisualStudio.Extensions.FileSystemExtensions;

namespace CodeStream.VisualStudio.Services
{
	/// <summary>
	/// This class handles communication between javascript and .NET
	/// </summary>
	public class PostMessageInterop
	{
		public void Handle(string message)
		{
			if (MessageHandler == null) return;

			MessageHandler(this, new WindowEventArgs(message));
		}

		public static WindowMessageHandler MessageHandler;
	}

	/// <summary>
	/// Implementation of a browser service using DotNetBrowser
	/// </summary>
	[Injected]
	public class DotNetBrowserService : BrowserServiceBase, DialogHandler, LoadHandler, ResourceHandler //, IProtocolHandler
	{
		private static readonly ILogger Log = LogManager.ForContext<DotNetBrowserService>();

		private readonly ICodeStreamAgentService _agent;
		private WPFBrowserView _browserView;
		private BrowserContext _browserContext;
		private string _path;

		/// <summary>
		/// This handles what is passed into DotNetBrowser as well as which Chromium switches get created
		/// </summary>
		public BrowserType BrowserType => BrowserType.HEAVYWEIGHT;

		public DotNetBrowserService(ICodeStreamAgentService agentService)
		{
			_agent = agentService;
		}

		protected override void OnInitialized()
		{
			var switches = DotNetBrowserSwitches.Create(BrowserType);

			BrowserPreferences.SetChromiumSwitches(switches.ToArray());

			_path = GetOrCreateContextParamsPath();
			_browserContext = new BrowserContext(new BrowserContextParams(_path));

			var browser = BrowserFactory.Create(_browserContext, BrowserType);

			browser.Preferences.AllowDisplayingInsecureContent = false;
			browser.Preferences.AllowRunningInsecureContent = false;
			browser.Preferences.AllowScriptsToCloseWindows = false;
			browser.Preferences.ApplicationCacheEnabled = false;
			browser.Preferences.DatabasesEnabled = false;
			browser.Preferences.LocalStorageEnabled = false;
			browser.Preferences.PluginsEnabled = false;
			browser.Preferences.TransparentBackground = true;
			browser.Preferences.UnifiedTextcheckerEnabled = false;
			browser.Preferences.WebAudioEnabled = false;

			browser.DialogHandler = this;
			browser.LoadHandler = this;
			browser.Context.NetworkService.ResourceHandler = this;

			browser.RenderGoneEvent += Browser_RenderGoneEvent;
			browser.ScriptContextCreated += Browser_ScriptContextCreated;

			_browserView = new WPFBrowserView(browser);
		}

		private void Browser_RenderGoneEvent(object sender, RenderEventArgs e)
		{
            Log.Verbose(nameof(Browser_RenderGoneEvent));

			ReloadWebView();
		}

		private void Browser_ScriptContextCreated(object sender, DotNetBrowser.Events.ScriptContextEventArgs e)
		{
			var jsValue = _browserView.Browser.ExecuteJavaScriptAndReturnValue("window");
			jsValue.AsObject().SetProperty("PostMessageInterop", new PostMessageInterop());

			Log.Verbose($"{nameof(Browser_ScriptContextCreated)} set window object");

			_browserView.Browser.ExecuteJavaScript(@"
				  window.acquireVsCodeApi = function() {
					  return {
						  postMessage: function(message) {
							window.PostMessageInterop.Handle(JSON.stringify(message));
						 }
					 }
				  }
			   ");

			Log.Verbose($"{nameof(Browser_ScriptContextCreated)} ExecuteJavaScript");
		}

		public override void AddWindowMessageEvent(WindowMessageHandler messageHandler)
		{
			PostMessageInterop.MessageHandler = messageHandler;

			Log.Verbose($"{nameof(AddWindowMessageEvent)}");
		}

		public override void PostMessage(string message)
		{
			_browserView.Browser.ExecuteJavaScript(@"window.postMessage(" + message + @",""*"");");
		}

		public override void LoadHtml(string html)
		{
			using (Log.TimeOperation($"Starting {nameof(LoadHtml)}"))
			{
				_browserView.Browser.LoadHTML(html);
			}
		}

		public override void AttachControl(FrameworkElement frameworkElement)
		{
			var grid = frameworkElement as Grid;
			if (grid == null)
				throw new InvalidOperationException("Grid");

			Grid.SetColumn(grid, 0);
			grid.Children.Add(_browserView);
		}

		public override string GetDevToolsUrl()
        {
            var url = _browserView.Browser.GetRemoteDebuggingURL();
            Log.Verbose($"DevTools Url={url}");
            return url;
		}

		/// <summary>
		/// Checks known files to see if DotNetBrowser is active. First a .lock file (randomly named), then a file known to exist in the directory (History)
		/// </summary>
		/// <param name="directoryPath"></param>
		/// <param name="lockInfo"></param>
		/// <param name="fileKnownToBeLocked">this is a known file name that lives in the DotNetBrowserDir that is known to hold a file lock</param>
		/// <returns></returns>
		private bool TryCheckUsage(string directoryPath, out DirectoryLockInfo lockInfo, string fileKnownToBeLocked = "History")
		{
			lockInfo = new DirectoryLockInfo(directoryPath);

			try
			{
				// this dir, doesn't exist... good to go!
				if (!Directory.Exists(directoryPath)) return false;

				var di = new DirectoryInfo(directoryPath);
				foreach (var file in di.GetFiles())
				{
					if (file.Extension.EqualsIgnoreCase(".lock"))
					{
						lockInfo.LockFile = file.FullName;
						return true;
					}
					if (file.Name.EqualsIgnoreCase(fileKnownToBeLocked))
					{
						if (IsFileLocked(file.FullName))
						{
							lockInfo.LockFile = file.FullName;
							return true;
						}
					}
				}
			}
			catch (Exception ex)
			{
				Log.Warning(ex, "IsInUse?");
				return true;
			}

			return false;
		}

		private string GetOrCreateContextParamsPath()
		{
			// the default directory from DotNetBrowser looks something like this:
			// C:\Users\<UserName>\AppData\Local\Temp\dotnetbrowser-chromium\64.0.3282.24.1.19.0.0.642\32bit\data
			// get it with BrowserPreferences.GetDefaultDataDir();

			var defaultPath = Application.TempDataPath + "Browser-0";
			Log.Verbose($"DefaultPath={defaultPath}");

			if (!TryCheckUsage(defaultPath, out DirectoryLockInfo info))
			{
				if (!info.HasLocked)
				{
					Log.Verbose($"Reusing {defaultPath} (not locked)");
					return defaultPath;
				}

				Log.Verbose($"Could not reuse ${defaultPath} - ${info.LockFile}");
			}

			string path = null;

			// this is mainly for dev / DEBUG -- users should never get this high
			for (var i = 1; i < 2000; i++)
			{
				path = Path.Combine(Application.TempDataPath, $"Browser-{i}");
				if (Directory.Exists(path))
				{
					var isLocked = TryCheckUsage(path, out DirectoryLockInfo lockInfo);
					if (lockInfo.HasLocked)
					{
						// this path/file exists, but it is locked, try another
						Log.Verbose($"{path}|{lockInfo.LockFile} IsLocked={isLocked}");
						continue;
					}

					Log.Verbose($"Using {path} -- (Not locked, use this)");
					// not locked... use it!
					break;
				}
				else
				{
					Log.Verbose($"Using {path} -- (Doesn't exist)");
					// doesn't exist -- use it!
					break;
				}
			}

			return path;
		}

		private bool _disposed;
		protected override void Dispose(bool disposing)
		{
			if (_disposed) return;

			var success = true;
			if (disposing)
			{
				try
				{
					if (_browserView == null)
					{
						Log.Verbose("DotNetBrowser is null");
						return;
					}

					if (_browserView?.IsDisposed == true)
					{
						Log.Verbose("DotNetBrowser already disposed");
						return;
					}

                    _browserView.Browser.RenderGoneEvent -= Browser_RenderGoneEvent;
                    _browserView.Browser.ScriptContextCreated -= Browser_ScriptContextCreated;

					_browserView.Dispose();
					_browserView.Browser.Dispose();
					_browserView.Browser.Context.Dispose();
					_browserView = null;

					var deleted = false;
					for (var i = 0; i < 5; i++)
					{
						if (deleted) break;

						try
						{
							Directory.Delete(_path, true);
							deleted = true;
							Log.Verbose($"Cleaned up {_path} on {i + 1} attempt");
						}
						catch (Exception ex)
						{
							Log.Warning(ex, $"Could not delete attempt ({i + 1}) {_path}");
						}
					}
				}
				catch (Exception ex)
				{
					Log.Warning(ex, "DotNetBrowser dispose failure");
					success = false;
				}

				if (success)
				{
					Log.Verbose("DotNetBrowser Disposed");
				}

				_disposed = true;
			}
		}

		private class DotNetBrowserSwitches
		{
			/// <summary>
			/// These switches must be used in either rendering
			/// </summary>
			private static readonly List<string> DefaultSwitches = new List<string>
			{
				"--disable-web-security",
				"--allow-file-access-from-files"
			};

			/// <summary>
			/// For improved LIGHTWEIGHT rendering
			/// </summary>
			/// <remarks>see https://dotnetbrowser.support.teamdev.com/support/solutions/articles/9000124916-accelerated-lightweight-rendering</remarks>
			private static readonly List<string> LightweightSwitches = new List<string>
			{
				"--disable-gpu",
				"--disable-gpu-compositing",
				"--enable-begin-frame-scheduling",
				"--software-rendering-fps=60"
			};

			// ReSharper disable once UnusedMember.Local
			private static readonly List<string> ChromiumSwitchesDebug = new List<string>
			{
				"--remote-debugging-port=9223"
			};

			public static List<string> Create(BrowserType browserType)
			{
				var switches = new List<string>(DefaultSwitches);
				if (browserType == BrowserType.LIGHTWEIGHT)
				{
					switches = switches.Combine(LightweightSwitches);
				}
#if DEBUG
				switches = ChromiumSwitchesDebug.Combine(switches);
#endif
				return switches;
			}
		}

		bool LoadHandler.OnLoad(LoadParams loadParams)
		{
			return false;
		}

		bool LoadHandler.CanNavigateOnBackspace()
		{
			return false;
		}

		bool LoadHandler.OnCertificateError(CertificateErrorParams errorParams)
		{
			return false;
		}

		bool ResourceHandler.CanLoadResource(ResourceParams parameters)
		{
			if (parameters.ResourceType == ResourceType.IMAGE || parameters.URL.StartsWith("file://"))
			{
				return true;
			}

			if (parameters.ResourceType == ResourceType.MAIN_FRAME)
			{
				_agent.SendAsync<JToken>("codestream/url/open", new { url = parameters.URL });
			}

			return false;
		}

		CloseStatus DialogHandler.OnBeforeUnload(UnloadDialogParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		void DialogHandler.OnAlert(DialogParams parameters)
		{
		}

		CloseStatus DialogHandler.OnConfirmation(DialogParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		CloseStatus DialogHandler.OnFileChooser(FileChooserParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		CloseStatus DialogHandler.OnPrompt(PromptDialogParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		CloseStatus DialogHandler.OnReloadPostData(ReloadPostDataParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		CloseStatus DialogHandler.OnColorChooser(ColorChooserParams parameters)
		{
			return CloseStatus.CANCEL;
		}

		CloseStatus DialogHandler.OnSelectCertificate(CertificatesDialogParams parameters)
		{
			return CloseStatus.CANCEL;
		}
	}
}
