using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Serilog;
using System;

namespace CodeStream.VisualStudio.UI
{
    public class DocumentMarkerManagerFactory
    {
        public static DocumentMarkerManager Create(ICodeStreamAgentService agentService, IWpfTextView wpfTextView, ITextDocument textDocument)
        {
            return new DocumentMarkerManager(agentService, wpfTextView, textDocument);
        }
    }

    public class DocumentMarkerManager: IDisposable
    {
        private readonly ICodeStreamAgentService _agentService;
        private readonly IWpfTextView _wpfTextView;
        private readonly ITextDocument _textDocument;
        bool _disposed = false;
        private DocumentMarkersResponse _markers;

        private static readonly ILogger Log = LogManager.ForContext<DocumentMarkerManager>();

        public DocumentMarkerManager(ICodeStreamAgentService agentService, IWpfTextView wpfTextView, ITextDocument textDocument)
        {
            _agentService = agentService;
            _wpfTextView = wpfTextView;
            _textDocument = textDocument;
        }

        public void GetOrCreateMarkers(bool forceUpdate = false)
        {
            if (_markers != null && _markers.Markers.AnySafe() == false && !forceUpdate)
            {
                Log.Verbose("Codemarks are empty and force={force}", forceUpdate);
                return;
            }

            var filePath = _textDocument.FilePath;
            if (!Uri.TryCreate(filePath, UriKind.Absolute, out Uri fileUri))
            {
                Log.Verbose($"Could not parse file path as uri={filePath}");
                return;
            }

            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                try
                {
                    _markers = await _agentService.GetMarkersForDocumentAsync(fileUri);

                    if (_markers?.Markers.AnySafe() == true || forceUpdate)
                    {
                        if (_wpfTextView.TextBuffer.Properties.ContainsProperty(PropertyNames.CodemarkMarkers))
                        {
                            _wpfTextView.TextBuffer.Properties.RemoveProperty(PropertyNames.CodemarkMarkers);
                        }

                        _wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.CodemarkMarkers, _markers.Markers);
                        Log.Verbose("Setting Codemarks Count={Count}", _markers.Markers.Count);
                    }
                    else
                    {
                        Log.Verbose("No Codemarks from agent");
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, nameof(GetOrCreateMarkers));
                }
            });
        }

        public void Reset()
        {
            _markers = null;
        }

        public bool IsInitialized() => _markers != null;

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
                return;

            if (disposing)
            {
                if (_wpfTextView?.TextBuffer?.Properties.ContainsProperty(PropertyNames.CodemarkMarkers) == true)
                {
                    _wpfTextView.TextBuffer.Properties.RemoveProperty(PropertyNames.CodemarkMarkers);
                }

                _markers = null;
            }

            _disposed = true;
        }
    }
}