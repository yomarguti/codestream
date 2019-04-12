using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;
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
using System.Reactive.Concurrency;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Threading;
using System.Windows.Threading;

public class TextViewCreationListenerDummy { }

namespace CodeStream.VisualStudio.UI {
	[Export(typeof(IVsTextViewCreationListener))]
	[Export(typeof(IWpfTextViewConnectionListener))]
	[ContentType(ContentTypes.Text)]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	public class TextViewCreationListener :
		IVsTextViewCreationListener,
		IWpfTextViewConnectionListener {

		private readonly ILogger Log = LogManager.ForContext<TextViewCreationListenerDummy>();

		private readonly IEventAggregator _eventAggregator;
		private readonly ISessionService _sessionService;		
		private readonly IIdeService _ideService;

		private static int DocumentCounter = 0;
		private static readonly object InitializedLock = new object();

		internal const string LayerName = "CodeStreamHighlightColor";

		public TextViewCreationListener() :
			this(Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator,
				Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
				ServiceLocator.Get<SIdeService, IIdeService>()) { }

		public TextViewCreationListener(IEventAggregator eventAggregator,
			ISessionService sessionService,			
			IIdeService ideService) {
			_eventAggregator = eventAggregator;
			_sessionService = sessionService;			
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
		public void SubjectBuffersConnected(IWpfTextView wpfTextView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers) {
			Log.Verbose($"{nameof(SubjectBuffersConnected)} started");
			if (wpfTextView == null) {
				Log.Verbose(@"wpfTextView is null");
				return;
			}

			wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewState, new TextViewState());
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
				Log.Verbose(@"TextDocument not found");
				return;
			}

			wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewFilePath, textDocument.FilePath);

			var agentService = Package.GetGlobalService((typeof(SCodeStreamAgentService))) as ICodeStreamAgentService;
			wpfTextView.Properties.GetOrCreateSingletonProperty(PropertyNames.DocumentMarkerManager,
				() => DocumentMarkerManagerFactory.Create(agentService, wpfTextView, textDocument));

			if (WpfTextViewCache.TryAdd(textDocument.FilePath, wpfTextView)) {
				Interlocked.Increment(ref DocumentCounter);
			}

			Log.Debug($"{nameof(SubjectBuffersConnected)} completed for {textDocument.FilePath} Reason={reason}");
		}

		/// <summary>
		/// VsTextViewCreated is created after all margins, etc.
		/// </summary>
		/// <param name="textViewAdapter"></param>
		public void VsTextViewCreated(IVsTextView textViewAdapter) {
			Log.Verbose($"{nameof(VsTextViewCreated)} started");
			var wpfTextView = EditorAdaptersFactoryService.GetWpfTextView(textViewAdapter);

			// find all of our textView margin providers (they should already have been created at this point)
			var textViewMarginProviders = TextViewMarginProviders
				 .Where(_ => _ as ICodeStreamMarginProvider != null)
				 .Select(_ => (_ as ICodeStreamMarginProvider)?.TextViewMargin)
				 .Where(_ => _ != null)
				 .ToList();

			if (!textViewMarginProviders.AnySafe()) {
				Log.Warning($"no {nameof(textViewMarginProviders)}");
				return;
			}

			wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewMarginProviders, textViewMarginProviders);
			Debug.Assert(_eventAggregator != null, nameof(_eventAggregator) + " != null");

			var visibleRangesSubject = new Subject<HostDidChangeEditorVisibleRangesNotificationSubject>();
			//listening on the main thread since we have to change the UI state
			wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewEvents, new List<IDisposable>
			{
				_eventAggregator.GetEvent<SessionReadyEvent>()
					.ObserveOnDispatcher()
					.Subscribe(_ =>
					{
						Log.Verbose($"{nameof(VsTextViewCreated)} SessionReadyEvent Session IsReady={_sessionService.IsReady}");
						if (_sessionService.IsReady)
						{
							OnSessionReady(wpfTextView);
						}
					}),

				_eventAggregator.GetEvent<SessionLogoutEvent>()
					.ObserveOnDispatcher()
					.Subscribe(_ => OnSessionLogout(wpfTextView, textViewMarginProviders)),

				_eventAggregator.GetEvent<MarkerGlyphVisibilityEvent>()
					.ObserveOnDispatcher()
					.Subscribe(_ => textViewMarginProviders.Toggle(_.IsVisible)),

				visibleRangesSubject.Throttle(TimeSpan.FromMilliseconds(10))
						.Subscribe(e => {
								ServiceLocator.Get<SWebviewIpc, IWebviewIpc>()?.NotifyAsync(
									new HostDidChangeEditorVisibleRangesNotificationType {
										Params = new HostDidChangeEditorVisibleRangesNotification(
											e.Uri,
											_ideService.GetActiveEditorState()?.ToEditorSelections(),
											e.WpfTextView.ToVisibleRanges(),
											e.WpfTextView.TextSnapshot?.LineCount
										)
									});
						})

			});

			wpfTextView.TextBuffer.Properties.AddProperty(PropertyNames.HostDidChangeEditorVisibleRangesNotificationSubject, visibleRangesSubject);

			Log.Verbose($"{nameof(VsTextViewCreated)} Session IsReady={_sessionService.IsReady}");

			if (_sessionService.IsReady) {
				OnSessionReady(wpfTextView);
			}
			else {
				textViewMarginProviders.Hide();
			}

			Log.Debug($"{nameof(VsTextViewCreated)} completed");
		}

		public void SubjectBuffersDisconnected(IWpfTextView textView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers) {
			Log.Verbose($"{nameof(SubjectBuffersDisconnected)} started");
			if (textView == null) {
				Log.Warning($"{nameof(SubjectBuffersDisconnected)} textView is null");
				return;
			}
			textView.RemovePropertySafe(PropertyNames.TextViewMarginProviders);
			textView.RemovePropertySafe(PropertyNames.DocumentMarkers);
			textView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewEvents);
			textView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);
			textView.LayoutChanged -= OnTextViewLayoutChanged;
			textView.Caret.PositionChanged -= Caret_PositionChanged;
			textView.TextBuffer.Properties.TryDisposeProperty<HighlightAdornmentManager>(PropertyNames.AdornmentManager);
			textView.TextBuffer.Properties.TryDisposeProperty<Subject<HostDidChangeEditorVisibleRangesNotificationSubject>>(PropertyNames.HostDidChangeEditorVisibleRangesNotificationSubject);

			if (textView.TextBuffer.Properties.ContainsProperty(PropertyNames.TextViewFilePath)) {
				var filePath = textView.TextBuffer.Properties.GetProperty<string>(PropertyNames.TextViewFilePath);
				if (filePath != null) {
					if (WpfTextViewCache.TryRemove(filePath)) {
						if (Interlocked.Decrement(ref DocumentCounter) == 0) {
							// notify that all have closed?
						}
						Log.Verbose($"{nameof(DocumentCounter)} ({DocumentCounter})");
					}
				}
				textView.RemovePropertySafe(PropertyNames.TextViewFilePath);
			}

			Log.Debug($"{nameof(SubjectBuffersDisconnected)} completed Reason={reason}");
		}

		public void OnSessionReady(IWpfTextView textView) {
			try {
				var state = textView.TextBuffer.Properties.GetProperty<TextViewState>(PropertyNames.TextViewState);
				Log.Verbose($"{nameof(OnSessionReady)} state={state?.Initialized}");
				// ReSharper disable InvertIf
				if (state != null && state.Initialized == false) {
					lock (InitializedLock) {
						if (!state.Initialized) {
							Log.Verbose($"{nameof(OnSessionReady)} state=initializing");
							textView.TextBuffer.Properties
								.AddProperty(PropertyNames.AdornmentManager, new HighlightAdornmentManager(textView));

							textView.TextBuffer.Properties.AddProperty(PropertyNames.TextViewLocalEvents,
								new List<IDisposable> {
									_eventAggregator.GetEvent<DocumentMarkerChangedEvent>()
										.Subscribe(_ => {
											Log.Verbose(
												$"{nameof(DocumentMarkerChangedEvent)} State={state.Initialized}, _={_?.Uri}");
											OnDocumentMarkerChanged(textView, _);
										})
								});

							textView.TextBuffer
								.Properties
								.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
								.OnSessionReady();

							// keep this at the end -- we want this to be the first handler
							textView.LayoutChanged += OnTextViewLayoutChanged;
							textView.Caret.PositionChanged += Caret_PositionChanged;
							state.Initialized = true;

							ChangeActiveWindow(textView);
						}
					}
				}
				// ReSharper restore InvertIf
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(OnSessionReady)}");
			}
		}

		private void ChangeActiveWindow(IWpfTextView wpfTextView) {
			if (wpfTextView == null) return;
			if (!wpfTextView.TextBuffer.Properties.TryGetProperty<string>(PropertyNames.TextViewFilePath, out string filePath)) return;
			if (filePath.IsNullOrWhiteSpace() || !_sessionService.IsWebViewVisible) return;

			var activeTextEditor = _ideService.GetActiveTextEditor(wpfTextView);
			if (activeTextEditor != null && activeTextEditor.Uri != null) {
				if (Uri.TryCreate(filePath, UriKind.RelativeOrAbsolute, out Uri result)) {
					if (activeTextEditor.Uri.EqualsIgnoreCase(result)) {
						var codeStreamService = ServiceLocator.Get<SCodeStreamService, ICodeStreamService>();
						codeStreamService.ChangeActiveWindowAsync(filePath, new Uri(filePath), activeTextEditor);
						Log.Verbose($"{nameof(ChangeActiveWindow)} filePath={filePath}");
					}
				}
			}
		}
		
		private static void OnSessionLogout(IWpfTextView wpfTextView, List<ICodeStreamWpfTextViewMargin> textViewMarginProviders) {
			if (wpfTextView.TextBuffer.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state)) {
				state.Initialized = false;
			}

			wpfTextView.TextBuffer.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);

			if (wpfTextView.TextBuffer
				.Properties
				.TryGetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager,
					out DocumentMarkerManager manager)) {
				manager.Reset();
			}

			textViewMarginProviders.OnSessionLogout();
		}

		private void OnDocumentMarkerChanged(IWpfTextView textView, DocumentMarkerChangedEvent e) {
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, textView.TextBuffer, out var textDocument)) {
				Log.Verbose(@"TextDocument not found");
				return;
			}

			var fileUri = textDocument.FilePath.ToUri();
			if (fileUri == null) {
				Log.Verbose($"{ nameof(fileUri)} is null");
				return;
			}
			try {
				if (e.Uri.EqualsIgnoreCase(fileUri)) {
					Log.Debug($"{nameof(DocumentMarkerChangedEvent)} for {fileUri}");

					textView
						.Properties
						.GetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager)
						.GetOrCreateMarkers(true);

					textView.TextBuffer
						.Properties
						.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
						.OnMarkerChanged();
				}
				else {
					Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} ignored for {fileUri}");
				}
			}
			catch (Exception ex) {
				Log.Warning(ex, $"{nameof(DocumentMarkerChangedEvent)} for {fileUri}");
			}
		}

		private void Caret_PositionChanged(object sender, CaretPositionChangedEventArgs e) {
			ChangeActiveWindow(e?.TextView as IWpfTextView);
		}

		private void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e) {
			var wpfTextView = sender as IWpfTextView;
			if (wpfTextView == null || !_sessionService.IsReady) return;

			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
				Log.Verbose(@"TextDocument not found");
				return;
			}

			var documentMarkerManager = wpfTextView
				.Properties
				.GetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager);

			if (documentMarkerManager == null) {
				Log.Warning($"{nameof(documentMarkerManager)} is null");
				return;
			}

			// get markers if it's null (first time) or we did something that isn't scrolling
			if (!documentMarkerManager.IsInitialized() || e.TranslatedLines.Any()) {
				documentMarkerManager.GetOrCreateMarkers();
			}

			// don't trigger for changes that don't result in lines being added or removed
			if (_sessionService.IsWebViewVisible && _sessionService.IsCodemarksForFileVisible &&
				(e.VerticalTranslation || e.TranslatedLines.Any())) {
				var visibleRangeSubject = wpfTextView.TextBuffer.Properties
					.GetProperty<Subject<HostDidChangeEditorVisibleRangesNotificationSubject>>(PropertyNames.HostDidChangeEditorVisibleRangesNotificationSubject);
				visibleRangeSubject?.OnNext(new HostDidChangeEditorVisibleRangesNotificationSubject(wpfTextView, textDocument.FilePath.ToUri()));
			}

			wpfTextView.TextBuffer
				.Properties
				.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
				.OnTextViewLayoutChanged(sender, e);
		}

		class TextViewState {
			public bool Initialized { get; set; }
		}

		internal class HostDidChangeEditorVisibleRangesNotificationSubject {
			public IWpfTextView WpfTextView { get; }
			public Uri Uri { get; }
			public HostDidChangeEditorVisibleRangesNotificationSubject(IWpfTextView wpfTextView, Uri uri) {
				WpfTextView = wpfTextView;
				Uri = uri;
			}
		}
	}
}
