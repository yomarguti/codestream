using System;
using CodeStream.VisualStudio.Core.Services;

namespace CodeStream.VisualStudio.Core.Models {
	public class SettingsScope : IDisposable {
		public ISettingsManager SettingsManager { get; private set; }

		private SettingsScope(ISettingsManager settingsManager) {
			SettingsManager = settingsManager;
		}

		private bool _disposed;

		public void Dispose() {
			Dispose(true);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed) return;

			if (disposing) {
				SettingsManager?.SaveSettingsToStorage();
			}

			_disposed = true;
		}

		public static SettingsScope Create(ISettingsManager settingsManager) {
			return new SettingsScope(settingsManager);
		}
	}
}
