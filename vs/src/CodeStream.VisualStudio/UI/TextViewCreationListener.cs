using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Adornments;
using CodeStream.VisualStudio.UI.Margins;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.TextManager.Interop;
using Microsoft.VisualStudio.Utilities;
using Serilog;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.Linq;
using System.Reactive.Linq;
using System.Threading;

namespace CodeStream.VisualStudio.UI
{
    [Export(typeof(IVsTextViewCreationListener))]
    [Export(typeof(IWpfTextViewConnectionListener))]
    [ContentType(ContentTypes.Text)]
    [TextViewRole(PredefinedTextViewRoles.Interactive)]
    [TextViewRole(PredefinedTextViewRoles.Document)]
    public class TextViewCreationListener :
        IVsTextViewCreationListener,
        IWpfTextViewConnectionListener
    {
        private readonly IEventAggregator _eventAggregator;
        private readonly ISessionService _sessionService;
        private readonly ISettingsService _settingsService;
        private readonly IIdeService _ideService;

        private static readonly object InitializedLock = new object();

        internal const string LayerName = "CodeStreamHighlightColor";

        public TextViewCreationListener() :
            this(Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator,
                Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
                Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService,
                ServiceLocator.Get<SIdeService, IIdeService>())
        { }

        public TextViewCreationListener(IEventAggregator eventAggregator,
            ISessionService sessionService,
            ISettingsService settingsService,
            IIdeService ideService)
        {
            _eventAggregator = eventAggregator;
            _sessionService = sessionService;
            _settingsService = settingsService;
            _ideService = ideService;
        }

        [Export(typeof(AdornmentLayerDefinition))]
        [Name(LayerName)]
        [Order(Before = PredefinedAdornmentLayers.Selection)]
        [TextViewRole(PredefinedTextViewRoles.Interactive)]
        [TextViewRole(PredefinedTextViewRoles.Document)]
        public AdornmentLayerDefinition AlternatingLineColor = null;


        [Import]
        public IVsEditorAdaptersFactoryService EditorAdaptersFactoryService { get; set; }

        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        [ImportMany]
        public IEnumerable<IWpfTextViewMarginProvider> TextViewMarginProviders { get; set; }

        /// <summary>
        /// SubjectBuffersConnected happens first
        /// </summary>
        /// <param name="wpfTextView"></param>
        /// <param name="reason"></param>
        /// <param name="subjectBuffers"></param>
        public void SubjectBuffersConnected(IWpfTextView wpfTextView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers)
        {
            if (wpfTextView == null) return;

            wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewState, new TextViewState());

            if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument))
            {
                return;
            }

            var agentService = Package.GetGlobalService((typeof(SCodeStreamAgentService))) as ICodeStreamAgentService;
            wpfTextView.Properties.GetOrCreateSingletonProperty(PropertyNames.DocumentMarkerManager,
                () => DocumentMarkerManagerFactory.Create(agentService, wpfTextView, textDocument));
        }

        /// <summary>
        /// VsTextViewCreated is created after all margins, etc.
        /// </summary>
        /// <param name="textViewAdapter"></param>
        public void VsTextViewCreated(IVsTextView textViewAdapter)
        {
            var wpfTextView = EditorAdaptersFactoryService.GetWpfTextView(textViewAdapter);

            // find all of our textView margin providers (they should already have been created at this point)
            var textViewMarginProviders = TextViewMarginProviders
                 .Where(_ => _ as ICodeStreamWpfTextViewMarginProvider != null)
                 .Select(_ => (_ as ICodeStreamWpfTextViewMarginProvider)?.TextViewMargin)
                 .Where(_ => _ != null)
                 .ToList();

            if (!textViewMarginProviders.AnySafe()) return;

            wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewMarginProviders, textViewMarginProviders);
            Debug.Assert(_eventAggregator != null, nameof(_eventAggregator) + " != null");

            //listening on the main thread since we have to change the UI state
            wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewEvents, new List<IDisposable>
            {
                _eventAggregator.GetEvent<SessionReadyEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ =>
                    {
                        if (_sessionService.IsReady)
                        {
                            OnSessionReady(wpfTextView);
                        }
                    }),

                _eventAggregator.GetEvent<SessionLogoutEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ => OnSessionLogout(wpfTextView, textViewMarginProviders)),

                _eventAggregator.GetEvent<MarkerVisibilityEvent>()
                    .ObserveOnDispatcher()
                    .Subscribe(_ => textViewMarginProviders.Toggle(_.IsVisible))
            });

            if (_sessionService.IsReady)
            {
                OnSessionReady(wpfTextView);
            }
            else
            {
                textViewMarginProviders.Hide();
            }
        }

        public void SubjectBuffersDisconnected(IWpfTextView textView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers)
        {
            if (textView == null) return;

            textView.RemovePropertySafe(PropertyNames.TextViewMarginProviders);
            textView.RemovePropertySafe(PropertyNames.CodemarkMarkers);

            if (textView.TextBuffer.Properties.ContainsProperty(PropertyNames.TextViewState))
            {
                textView.TextBuffer.Properties.GetProperty<TextViewState>(PropertyNames.TextViewState).Initialized = false;
            }

            textView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewEvents);
            textView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);

            textView.LayoutChanged -= OnTextViewLayoutChanged;

            textView.TextBuffer.Properties.TryDisposeProperty<HighlightAdornmentManager>(PropertyNames.AdornmentManager);
        }

        public void OnSessionReady(IWpfTextView textView)
        {
            var state = textView.TextBuffer.Properties.GetProperty<TextViewState>(PropertyNames.TextViewState);
            // ReSharper disable InvertIf
            if (!state.Initialized)
            {
                lock (InitializedLock)
                {
                    if (!state.Initialized)
                    {
                        textView.TextBuffer.Properties
                            .AddProperty(PropertyNames.AdornmentManager, new HighlightAdornmentManager(textView));


                        textView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewLocalEvents,
                            new List<IDisposable>()
                            {
                                _eventAggregator.GetEvent<DocumentMarkerChangedEvent>()
                                    .ObserveOnDispatcher()
                                    .Throttle(TimeSpan.FromMilliseconds(100))
                                    .Subscribe((_) => ThreadHelper.JoinableTaskFactory.Run(async delegate
                                    {
                                        await OnDocumentMarkerChangedAsync(textView, _);
                                    }))
                            });

                        textView.TextBuffer
                            .Properties
                            .GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
                            .OnSessionReady();

                        // keep this at the end -- we want this to be the first handler
                        textView.LayoutChanged += OnTextViewLayoutChanged;
                        state.Initialized = true;
                    }
                }
            }
            // ReSharper restore InvertIf
        }

        private static void OnSessionLogout(IWpfTextView wpfTextView, List<ICodeStreamWpfTextViewMargin> textViewMarginProviders)
        {
            if (wpfTextView.TextBuffer.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state))
            {
                state.Initialized = false;
            }

            wpfTextView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);

            if (wpfTextView.TextBuffer
                .Properties
                .TryGetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager,
                    out DocumentMarkerManager manager))
            {
                manager.Reset();
            }

            textViewMarginProviders.OnSessionLogout();
        }

        private async System.Threading.Tasks.Task OnDocumentMarkerChangedAsync(IWpfTextView textView, DocumentMarkerChangedEvent e)
        {
            if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, textView.TextBuffer, out var textDocument))
            {
                return;
            }

            var fileUri = textDocument.FilePath.ToUri();
            if (fileUri == null)
            {
                Log.Verbose($"{nameof(fileUri)} is null");
                return;
            }
            try
            {
                if (e.Uri.EqualsIgnoreCase(fileUri))
                {
                    Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} for {fileUri}");
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

                    textView
                        .Properties
                        .GetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager)
                        .GetOrCreateMarkers(true);

                    textView.TextBuffer
                        .Properties
                        .GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
                        .OnMarkerChanged();
                }
                else
                {
                    Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} ignored for {fileUri}");
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, $"{nameof(DocumentMarkerChangedEvent)} for {fileUri}");
            }

            await System.Threading.Tasks.Task.CompletedTask;
        }

        private void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            // don't trigger for changes that don't result in lines being added or removed
           // if (!e.TranslatedLines.Any() && !e.TranslatedSpans.Any()) return;

            var wpfTextView = sender as IWpfTextView;
            if (wpfTextView == null || !_sessionService.IsReady) return;

            if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument))
            {
                return;
            }

            var documentMarkerManager = wpfTextView
                .Properties
                .GetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager);

            if (documentMarkerManager == null)
            {
                Log.Debug($"{nameof(documentMarkerManager)} is null");
                return;
            }

            // get markers if it's null (first time) or we did something that isn't scrolling
            if (!documentMarkerManager.IsInitialized() || e.TranslatedLines.Any())
            {
                documentMarkerManager.GetOrCreateMarkers();
            }

            if (_settingsService.ViewCodemarksInline && (e.TranslatedLines.Any() || e.TranslatedSpans.Any()))
            {
                var activeEditorState = _ideService.GetActiveEditorState();

                ServiceLocator.Get<SWebviewIpc, IWebviewIpc>()?.Notify(new HostDidChangeEditorVisibleRangesNotificationType
                {
                    Params = new HostDidChangeEditorVisibleRangesNotification(
                            textDocument.FilePath.ToUri(),
                            activeEditorState.ToEditorSelections(),
                            wpfTextView.ToVisibleRanges())
                });
            }

            wpfTextView.TextBuffer
                .Properties
                .GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
                .OnTextViewLayoutChanged(sender, e);
        }

        class TextViewState
        {
            public bool Initialized { get; set; }
        }
    }
}
