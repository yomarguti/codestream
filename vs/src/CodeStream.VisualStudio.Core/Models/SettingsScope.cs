using System;
using CodeStream.VisualStudio.Core.Services;

namespace CodeStream.VisualStudio.Core.Models {
	public class SettingsScope : IDisposable {
		public ISettingsManager SettingsManager { get; }

		private readonly bool _pauseNotifyPropertyChanged;
		private SettingsScope(ISettingsManager settingsManager, bool pauseNotifyPropertyChanged) {
			SettingsManager = settingsManager;
			_pauseNotifyPropertyChanged = pauseNotifyPropertyChanged;
		}

		private bool _disposed;

		public void Dispose() {
			Dispose(true);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed) return;

			if (disposing) {
				try {
					// attempt to save the settings to storage
					SettingsManager?.SaveSettingsToStorage();
				}
				finally {
					// if we're paused, attempt to un-pause
					if (_pauseNotifyPropertyChanged) {
						SettingsManager?.ResumeNotifications();
					}
				}
			}

			_disposed = true;
		}

		public static SettingsScope Create(ISettingsManager settingsManager, bool pauseNotifyPropertyChanged = false) {
			if (pauseNotifyPropertyChanged) {
				settingsManager.PauseNotifications();
			}
			return new SettingsScope(settingsManager, pauseNotifyPropertyChanged);
		}
	}
}
