using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using CodeStream.VisualStudio.UI.Extensions;

namespace CodeStream.VisualStudio.UI {
	public class DocumentMarkerManager : IDisposable {
		private readonly ICodeStreamAgentService _agentService;
		private readonly IWpfTextView _wpfTextView;
		private readonly ITextDocument _textDocument;
		bool _disposed = false;
		private DocumentMarkersResponse _markers;

		private static readonly ILogger Log = LogManager.ForContext<DocumentMarkerManager>();

		public DocumentMarkerManager(ICodeStreamAgentService agentService, IWpfTextView wpfTextView, ITextDocument textDocument) {
			_agentService = agentService;
			_wpfTextView = wpfTextView;
			_textDocument = textDocument;
		}

		/// <summary>
		/// tries to populate the marker collection, returns true if requires update
		/// </summary>
		/// <param name="forceUpdate"></param>
		/// <returns></returns>
		public bool GetMarkers(bool forceUpdate = false) {
			if (_markers != null && _markers.Markers.AnySafe() == false && !forceUpdate) {
				Log.Verbose($"Codemarks are empty and forceUpdate={forceUpdate}", forceUpdate);
				return false;
			}

			var fileUri = _textDocument.FilePath.ToUri();
			if (fileUri == null) {
				Log.Verbose($"Could not parse file path as uri={_textDocument.FilePath}");
				return false;
			}

			bool result = false;
			ThreadHelper.JoinableTaskFactory.Run(async delegate {
				try {
					_markers = await _agentService.GetMarkersForDocumentAsync(fileUri, true);
					bool? previousResult = null;
					if (_markers?.Markers.AnySafe() == true || forceUpdate) {
						if (_wpfTextView.Properties.TryGetProperty(PropertyNames
							.DocumentMarkers, out List<DocumentMarker> previousMarkersResponse)) {
							previousResult = previousMarkersResponse.AnySafe();
						}
						_wpfTextView.Properties.RemovePropertySafe(PropertyNames.DocumentMarkers);
						_wpfTextView.Properties.AddProperty(PropertyNames.DocumentMarkers, _markers?.Markers);
						Log.Debug("Setting Markers({Count})", _markers?.Markers.Count);
						var current = _markers?.Markers.Any() == true;
						if (previousResult == true && current == false) {
							result = true;
						}
						else if (current) {
							result = true;
						}
					}
					else {
						Log.Verbose("No Codemarks from agent");
					}
				}
				catch (OverflowException ex) {
#if DEBUG
					Log.Warning(ex, fileUri.ToString());
#else
					Log.Error(ex, fileUri.ToString());
#endif
				}
				catch (Exception ex) {
					Log.Error(ex, nameof(GetMarkers));
				}
			});
			return result;
		}

		public void Reset() {
			_markers = null;
		}

		public bool HasMarkers() => _markers?.Markers.AnySafe() == true;

		public bool IsInitialized() => _markers != null;

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed)
				return;

			if (disposing) {
				if (_wpfTextView?.Properties.ContainsProperty(PropertyNames.DocumentMarkers) == true) {
					_wpfTextView.Properties.RemoveProperty(PropertyNames.DocumentMarkers);
				}

				_markers = null;
			}

			_disposed = true;
		}
	}
}
