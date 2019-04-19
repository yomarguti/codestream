using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Resources;
using System.Windows;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Serilog;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services {
	public class WindowEventArgs {
		public WindowEventArgs(string message) {
			Message = message;
		}

		public string Message { get; }
	}

	public interface SBrowserService { }

	public interface IBrowserService : IDisposable {
		void Initialize();
		/// <summary>
		/// Sends the string to the web view
		/// </summary>
		/// <param name="message"></param>
		void PostMessage(string message, bool canEnqueue = false);
		/// <summary>
		/// Object to be JSON-serialized before sending to the webview
		/// </summary>
		/// <param name="message"></param>
		void PostMessage(IAbstractMessageType message, bool canEnqueue = false);
		void LoadHtml(string html);
		void AddWindowMessageEvent(WindowMessageHandler messageHandler);
		/// <summary>
		/// Attaches the control to the parent element
		/// </summary>
		/// <param name="frameworkElement"></param>
		void AttachControl(FrameworkElement frameworkElement);
		/// <summary>
		/// Loads the webview
		/// </summary>
		void LoadWebView();
		/// <summary>
		/// waiting / loading / pre-LSP page
		/// </summary>
		void LoadSplashView();
		/// <summary>
		/// Reloads the webview completely
		/// </summary>
		void ReloadWebView();
		/// <summary>
		/// Gets the url for the dev tools
		/// </summary>
		/// <returns></returns>
		string GetDevToolsUrl();

		int QueueCount { get; }
	}

	public delegate Task WindowMessageHandler(object sender, WindowEventArgs e);

	public abstract class BrowserServiceBase : IBrowserService, SBrowserService {
		private static readonly ILogger Log = LogManager.ForContext<BrowserServiceBase>();

		public virtual void Initialize() {
			Log.Verbose($"{GetType()} {nameof(Initialize)} Browser...");
			OnInitialized();
			Log.Verbose($"{GetType()} {nameof(Initialize)} Browser");
		}

		protected virtual void OnInitialized() { }

		public abstract void AddWindowMessageEvent(WindowMessageHandler messageHandler);

		public abstract void AttachControl(FrameworkElement frameworkElement);

		public virtual void LoadHtml(string html) { }

		public virtual int QueueCount {get;}

		/// <summary>
		/// Sends message to the browser, also contains logic for queuing messages
		/// before the agent is ready
		/// </summary>
		/// <param name="message"></param>
		public abstract void PostMessage(string message, bool canEnqueue = false);

		public virtual void PostMessage(IAbstractMessageType message, bool canEnqueue = false) {
			PostMessage(message.AsJson(), canEnqueue);
		}

		public void LoadWebView() {
			LoadHtml(CreateWebViewHarness(Assembly.GetAssembly(typeof(BrowserServiceBase)), "webview"));
		}

		public void LoadSplashView() {
			LoadHtml(CreateWebViewHarness(Assembly.GetAssembly(typeof(BrowserServiceBase)), "waiting"));
		}

		public virtual void ReloadWebView() {
			LoadWebView();
			Log.Debug($"{nameof(ReloadWebView)}");
		}

		public virtual string GetDevToolsUrl() => null;

		private string CreateWebViewHarness(Assembly assembly, string resourceName) {
			var resourceManager = new ResourceManager("VSPackage", Assembly.GetExecutingAssembly());
			var dir = Path.GetDirectoryName(assembly.Location);
			Debug.Assert(dir != null, nameof(dir) + " != null");

			// ReSharper disable once ResourceItemNotResolved
			var harness = resourceManager.GetString(resourceName);
			Debug.Assert(harness != null, nameof(harness) + " != null");

			harness = harness.Replace("{root}", dir.Replace(@"\", "/"));
			// ReSharper disable once ResourceItemNotResolved
			var styleSheet = resourceManager.GetString("theme");

			var theme = ThemeManager.Generate();
			var isDebuggingEnabled = Log.IsDebugEnabled();

			var outputDebug = new Dictionary<string, Tuple<string, string>>();
			harness = harness.Replace("{bodyClass}", theme.IsDark ? "vscode-dark" : "vscode-light");

			if (styleSheet != null) {
				foreach (var item in theme.ThemeResources) {
					styleSheet = styleSheet.Replace($"--cs--{item.Key}--", item.Value);

					if (isDebuggingEnabled) {
						outputDebug[item.Key] = Tuple.Create(item.Key, item.Value);
					}
				}

				foreach (var item in theme.ThemeColors) {
					var color = theme.IsDark
						? item.DarkModifier == null ? item.Color : item.DarkModifier(item.Color)
						: item.LightModifier == null ? item.Color : item.LightModifier(item.Color);

					styleSheet = styleSheet.Replace($"--cs--{item.Key}--", color.ToRgba());

					if (isDebuggingEnabled) {
						outputDebug[item.Key] = Tuple.Create(item.Key, color.ToRgba());
					}
				}
			}

			harness = harness.Replace(@"<style id=""theme""></style>", $@"<style id=""theme"">{styleSheet}</style>");

#if !DEBUG
			if (isDebuggingEnabled)
			{
				Log.Debug(outputDebug.ToJson(format: true));
				Log.Debug(styleSheet);
			}
			Log.Verbose(harness);
#endif
			return harness;
		}

		private bool _isDisposed;
		public void Dispose() {
			if (!_isDisposed) {
				Log.Verbose("Browser Dispose...");

				Dispose(true);
				_isDisposed = true;
			}
		}

		protected virtual void Dispose(bool disposing) {}
	}

	public class NullBrowserService : BrowserServiceBase {
		public override void AddWindowMessageEvent(WindowMessageHandler messageHandler) { }
		public override void AttachControl(FrameworkElement frameworkElement) { }
		public override void PostMessage(string message, bool canQueue) { }
	}
}
