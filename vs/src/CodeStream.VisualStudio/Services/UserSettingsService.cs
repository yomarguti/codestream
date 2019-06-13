using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services.Providers;
using EnvDTE;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Serilog;

namespace CodeStream.VisualStudio.Services {
	public interface SUserSettingsService { }

	public interface IUserSettingsService {
		Task<T> TryGetValueAsync<T>(string bucketName, string dataKey);
		Task<bool> SaveAsync(string bucketName, string dataKey, object obj);
	}

	/// <summary>
	/// Saves settings based on the current solution file name
	/// </summary>
	public class UserSettingsService : SUserSettingsService, IUserSettingsService {
		private readonly IServiceProvider _serviceProvider;
		private readonly ISettingsProvider _settingsProvider;
		private static readonly ILogger Log = LogManager.ForContext<UserSettingsService>();
		public UserSettingsService(IServiceProvider serviceProvider) {
			_serviceProvider = serviceProvider;
			_settingsProvider = new ShellSettingsProvider(serviceProvider);
		}

		private const string CollectionName = "codestream";
		private const string PropertyFormat = "codestream.{0}";

		/// <summary>
		/// Gets data from a bucket within the codestream collection. Requires the UI thread
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="bucketName"></param>
		/// <param name="dataKey"></param>
		/// <returns></returns>
		public async Task<T> TryGetValueAsync<T>(string bucketName, string dataKey) {
			if (bucketName.IsNullOrWhiteSpace() || dataKey.IsNullOrWhiteSpace()) {
				return default(T);
			}
			try {
				await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

				var settings = Load(bucketName);
				if (settings == null || settings.Data == null) {
					return default(T);
				}
				if (settings.Data.TryGetValue(dataKey.ToLowerInvariant(), out object value)) {

					if (value != null) {
						var str = value as string;
						if (str != null) {
							return (T)Convert.ChangeType(value, typeof(T));
						}
						var jObject = value as JObject;
						if (jObject != null) {
							var data = jObject.ToObject<T>();
#if DEBUG
							Log.Verbose($"{nameof(TryGetValueAsync)} to {@data}");
#else
							Log.Verbose($"{nameof(TryGetValueAsync)} found");
#endif
							return data;
						}
					}
				}
			}
			catch (InvalidCastException ex) {
				Log.Error(ex, $"{nameof(TryGetValueAsync)} InvalidCastException Key={dataKey}");
				return default(T);
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(TryGetValueAsync)} Key={dataKey}");
				return default(T);
			}
			return default(T);
		}

		/// <summary>
		/// Saves data to a bucket within the codestream collection. Requires the UI thread
		/// </summary>
		/// <param name="bucketName"></param>
		/// <param name="dataKey"></param>
		/// <param name="obj"></param>
		/// <returns></returns>
		public async Task<bool> SaveAsync(string bucketName, string dataKey, object obj) {
			string solutionName = null;
			string propertyName = null;
			try {
				await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

				if (bucketName.Contains("{{solutionName}}")) {
					solutionName = GetSolutionName();
					if (solutionName.IsNullOrWhiteSpace()) {
						Log.Verbose($"{nameof(SaveAsync)} No solution name");
						return false;
					}
					bucketName = bucketName.Replace("{{solutionName}}", solutionName);
				}
				propertyName = string.Format(PropertyFormat, bucketName).ToLowerInvariant();
				var loaded = Load(bucketName);
				if (loaded == null) {
					loaded = new UserSettings { Data = new Dictionary<string, object>() };
				}

				if (loaded.Data.ContainsKey(dataKey) && obj == null) {
					loaded.Data.Remove(dataKey);
				}
				else {
					loaded.Data[dataKey] = obj;
				}

				_settingsProvider.SetString(CollectionName, propertyName, JsonConvert.SerializeObject(loaded));
				Log.Verbose($"{nameof(SaveAsync)} to {CollectionName}:{propertyName}");

				return true;
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(SaveAsync)} Key={dataKey} SolutionName={solutionName} PropertyName={propertyName}");
			}
			return false;
		}

		private UserSettings Load(string bucketName) {
			try {
				System.Windows.Threading.Dispatcher.CurrentDispatcher.VerifyAccess();

				if (bucketName.Contains("{{solutionName}}")) {
					var solutionName = GetSolutionName();
					if (solutionName.IsNullOrWhiteSpace()) {
						Log.Verbose($"{nameof(Load)} No solution name");
						return null;
					}

					bucketName = bucketName.Replace("{{solutionName}}", solutionName);
				}
				if (_settingsProvider.TryGetString(CollectionName, string.Format(PropertyFormat, bucketName),
					out string data)) {
					Log.Verbose($"{nameof(Load)} Loaded={data}");
					return JsonConvert.DeserializeObject<UserSettings>(data);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(Load));
			}

			return new UserSettings {
				Data = new Dictionary<string, object>()
			};
		}

		private string GetSolutionName() {
			try {
				System.Windows.Threading.Dispatcher.CurrentDispatcher.VerifyAccess();

				var dte = (DTE)_serviceProvider.GetService(typeof(DTE));
				if (dte == null) return null;

				var solutionPath = dte.Solution.FullName;
				if (solutionPath.IsNullOrWhiteSpace()) return null;

				var solutionName = System.IO.Path.GetFileName(solutionPath).ToLowerInvariant();
				Log.Verbose($"{nameof(GetSolutionName)} : {solutionName}");
				return solutionName;
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(GetSolutionName));
			}

			return null;
		}
	}

	public class UserSettings {
		public Dictionary<string, object> Data { get; set; }
	}
}
