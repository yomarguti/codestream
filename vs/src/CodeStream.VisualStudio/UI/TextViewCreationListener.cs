using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Adornments;
using CodeStream.VisualStudio.UI.Margins;
using Microsoft.VisualStudio.Editor;
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
using System.Reactive.Subjects;
using System.Runtime.CompilerServices;

public class TextViewCreationListenerDummy { }

namespace CodeStream.VisualStudio.UI {
	[Export(typeof(IVsTextViewCreationListener))]
	[Export(typeof(IWpfTextViewConnectionListener))]
	[ContentType(ContentTypes.Text)]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
	[TextViewRole(PredefinedTextViewRoles.Editable)]
	public class TextViewCreationListener :
		IVsTextViewCreationListener,
		IWpfTextViewConnectionListener {

		private readonly ILogger Log = LogManager.ForContext<TextViewCreationListenerDummy>();

		private readonly IEventAggregator _eventAggregator;
		private readonly ISessionService _sessionService;
		private readonly ICodeStreamAgentService _codeStreamAgentService;
		private readonly IIdeService _ideService;
		private readonly IWpfTextViewCache _textViewCache;
		private readonly ICodeStreamService _codeStreamService;
		private IWpfTextView _focusedWpfTextView;
		private static readonly object InitializedLock = new object();

		internal const string LayerName = "CodeStreamHighlightColor";

		private static readonly object WeakTableLock = new object();
		private static readonly ConditionalWeakTable<ITextBuffer, HashSet<IWpfTextView>> TextBufferTable =
			new ConditionalWeakTable<ITextBuffer, HashSet<IWpfTextView>>();

		public TextViewCreationListener() :
			this(ServiceLocator.Get<SEventAggregator, IEventAggregator>(),
				ServiceLocator.Get<SSessionService, ISessionService>(),
				ServiceLocator.Get<SCodeStreamAgentService, ICodeStreamAgentService>(),
				ServiceLocator.Get<SIdeService, IIdeService>(),
				ServiceLocator.Get<SWpfTextViewCache, IWpfTextViewCache>(),
				ServiceLocator.Get<SCodeStreamService, ICodeStreamService>()) { }

		public TextViewCreationListener(IEventAggregator eventAggregator,
			ISessionService sessionService,
			ICodeStreamAgentService codeStreamAgentService,
			IIdeService ideService,
			IWpfTextViewCache textViewCache,
			ICodeStreamService codeStreamService) {
			_eventAggregator = eventAggregator;
			_sessionService = sessionService;
			_codeStreamAgentService = codeStreamAgentService;
			_ideService = ideService;
			_textViewCache = textViewCache;
			_codeStreamService = codeStreamService;

		}

		/// <summary>
		/// This is needed for the Highlight adornment layer
		/// </summary>
		[Export(typeof(AdornmentLayerDefinition))]
		[Name(LayerName)]
		[Order(Before = PredefinedAdornmentLayers.Selection)]
		[TextViewRole(PredefinedTextViewRoles.Interactive)]
		[TextViewRole(PredefinedTextViewRoles.Document)]
		[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
		[TextViewRole(PredefinedTextViewRoles.Editable)]
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
			if (wpfTextView == null || !wpfTextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return;
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
				return;
			}

			lock (WeakTableLock) {
				foreach (var buffer in subjectBuffers) {
					if (!TextBufferTable.TryGetValue(buffer, out HashSet<IWpfTextView> textViews)) {
						textViews = new HashSet<IWpfTextView>();
						TextBufferTable.Add(buffer, textViews);
					}
					textViews.Add(wpfTextView);
				}

				wpfTextView.Properties.GetOrCreateSingletonProperty(PropertyNames.DocumentMarkerManager,
					() => DocumentMarkerManagerFactory.Create(_codeStreamAgentService, wpfTextView, textDocument));
				wpfTextView.Properties.AddProperty(PropertyNames.TextViewFilePath, textDocument.FilePath);
				wpfTextView.Properties.AddProperty(PropertyNames.TextViewState, new TextViewState());

				_textViewCache.Add(textDocument.FilePath, wpfTextView);
			}
		}

		/// <summary>
		/// VsTextViewCreated is created after all margins, etc.
		/// </summary>
		/// <param name="textViewAdapter"></param>
		public void VsTextViewCreated(IVsTextView textViewAdapter) {
			var wpfTextView = EditorAdaptersFactoryService.GetWpfTextView(textViewAdapter);
			if (wpfTextView == null || !wpfTextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return;

			// find all of our textView margin providers (they should already have been created at this point)
			var textViewMarginProviders = TextViewMarginProviders
				 .Where(_ => _ as ICodeStreamMarginProvider != null)
				 .Select(_ => (_ as ICodeStreamMarginProvider)?.TextViewMargin)
				 .Where(_ => _ != null)
				 .ToList();

			if (!textViewMarginProviders.AnySafe()) {
				Log.Warning($"No {nameof(textViewMarginProviders)}");
				return;
			}

			using (Log.CriticalOperation($"{nameof(VsTextViewCreated)}")) {
				wpfTextView.Properties.AddProperty(PropertyNames.TextViewMarginProviders, textViewMarginProviders);
				Debug.Assert(_eventAggregator != null, nameof(_eventAggregator) + " != null");

				var visibleRangesSubject = new Subject<HostDidChangeEditorVisibleRangesNotificationSubject>();
				//listening on the main thread since we have to change the UI state
				wpfTextView.Properties.AddProperty(PropertyNames.TextViewEvents, new List<IDisposable>
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
							try {
								if (e.WpfTextView.InLayout || e.WpfTextView.IsClosed) {
									return;
								}
								_codeStreamService.WebviewIpc?.NotifyAsync(
									new HostDidChangeEditorVisibleRangesNotificationType {
										Params = new HostDidChangeEditorVisibleRangesNotification(
											e.Uri,
											_ideService.GetActiveEditorState()?.ToEditorSelections(),
											e.WpfTextView.ToVisibleRanges(),
											e.WpfTextView.TextSnapshot?.LineCount
										)
									});
							}
							catch (Exception ex) {
								Log.Error(ex, "visibleRangeSubject");
							}
						})

				});

				wpfTextView.Properties.AddProperty(PropertyNames.HostDidChangeEditorVisibleRangesNotificationSubject, visibleRangesSubject);

				Log.Verbose($"{nameof(VsTextViewCreated)} Session IsReady={_sessionService.IsReady}");

				if (_sessionService.IsReady) {
					OnSessionReady(wpfTextView);
				}
				else {
					textViewMarginProviders.Hide();
				}
			}
		}

		public void SubjectBuffersDisconnected(IWpfTextView wpfTextView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers) {
			if (wpfTextView == null || wpfTextView?.Roles.ContainsAll(TextViewRoles.DefaultRoles) == false) return;
			if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) return;

			lock (WeakTableLock) {
				// we need to check all buffers reported since we will be called after actual changes have happened. 
				// for example, if content type of a buffer changed, we will be called after it is changed, rather than before it.
				foreach (var buffer in subjectBuffers) {
					if (TextBufferTable.TryGetValue(buffer, out HashSet<IWpfTextView> textViews)) {
						textViews.Remove(wpfTextView);
						_textViewCache.Remove(filePath, wpfTextView);

						if (textViews.Count == 0) {
							TextBufferTable.Remove(buffer);

							wpfTextView.LayoutChanged -= OnTextViewLayoutChanged;
							wpfTextView.Caret.PositionChanged -= Caret_PositionChanged;
							wpfTextView.GotAggregateFocus -= TextView_GotAggregateFocus;
							wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewFilePath);
							wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewState);
							wpfTextView.Properties.RemovePropertySafe(PropertyNames.DocumentMarkers);
							wpfTextView.Properties.RemovePropertySafe(PropertyNames.DocumentMarkerManager);
							wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewMarginProviders);
							wpfTextView.Properties.TryDisposeProperty<HighlightAdornmentManager>(PropertyNames.AdornmentManager);
							wpfTextView.Properties.TryDisposeProperty<Subject<HostDidChangeEditorVisibleRangesNotificationSubject>>(PropertyNames.HostDidChangeEditorVisibleRangesNotificationSubject);
							wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewEvents);
							wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);
						}
					}
				}
				if (_textViewCache.Count() == 0) {
					ResetActiveEditor();
				}
			}
		}

		public void OnSessionReady(IWpfTextView textView) {
			try {
				if (!textView.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state)) {
					return;
				}

				Log.Verbose($"{nameof(OnSessionReady)} state={state?.Initialized}");
				// ReSharper disable InvertIf
				if (state != null && state.Initialized == false) {
					lock (InitializedLock) {
						if (!state.Initialized) {
							Log.Verbose($"{nameof(OnSessionReady)} state=initializing");
							textView.Properties
								.AddProperty(PropertyNames.AdornmentManager, new HighlightAdornmentManager(textView));

							textView.Properties.AddProperty(PropertyNames.TextViewLocalEvents,
								new List<IDisposable> {
									_eventAggregator.GetEvent<DocumentMarkerChangedEvent>()
										.Subscribe(_ => {
											Log.Verbose(
												$"{nameof(DocumentMarkerChangedEvent)} State={state.Initialized}, _={_?.Uri}");
											OnDocumentMarkerChanged(textView, _);
										})
								});

							textView
								.Properties
								.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
								.OnSessionReady();

							// keep this at the end -- we want this to be the first handler
							textView.LayoutChanged += OnTextViewLayoutChanged;
							textView.Caret.PositionChanged += Caret_PositionChanged;
							textView.GotAggregateFocus += TextView_GotAggregateFocus;
							state.Initialized = true;

							ChangeActiveEditor(textView);
						}
					}
				}
				// ReSharper restore InvertIf
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(OnSessionReady)}");
			}
		}

		private void TextView_GotAggregateFocus(object sender, EventArgs e) {
			if (!(sender is IWpfTextView wpfTextView)) return;
			if (_focusedWpfTextView == null || _focusedWpfTextView != wpfTextView) {
				ChangeActiveEditor(wpfTextView);
				_focusedWpfTextView = wpfTextView;
			}
		}

		private void ResetActiveEditor() {
			try {
				_codeStreamService.ResetActiveEditorAsync();
				_focusedWpfTextView = null;
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(ChangeActiveEditor));
			}
		}

		private void ChangeActiveEditor(IWpfTextView wpfTextView) {
			try {
				if (wpfTextView == null) return;
				if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) return;
				if (filePath.IsNullOrWhiteSpace() || !_sessionService.IsWebViewVisible) return;

				var activeTextEditor = _ideService.GetActiveTextEditor(wpfTextView);
				if (activeTextEditor != null && activeTextEditor.Uri != null) {
					if (Uri.TryCreate(filePath, UriKind.RelativeOrAbsolute, out Uri result)) {
						if (activeTextEditor.Uri.EqualsIgnoreCase(result)) {
							_codeStreamService.ChangeActiveEditorAsync(filePath, new Uri(filePath), activeTextEditor);
							Log.Verbose($"{nameof(ChangeActiveEditor)} filePath={filePath}");
						}
					}
				}
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(ChangeActiveEditor));
			}
		}

		private static void OnSessionLogout(IWpfTextView wpfTextView, List<ICodeStreamWpfTextViewMargin> textViewMarginProviders) {
			if (wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state)) {
				state.Initialized = false;
			}

			wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);

			if (wpfTextView
				.Properties
				.TryGetProperty(PropertyNames.DocumentMarkerManager,
					out DocumentMarkerManager manager)) {
				manager.Reset();
			}

			textViewMarginProviders.OnSessionLogout();
		}

		private void OnDocumentMarkerChanged(IWpfTextView textView, DocumentMarkerChangedEvent e) {
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, textView.TextBuffer, out var textDocument)) {
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

					textView
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
			ChangeActiveEditor(e?.TextView as IWpfTextView);
		}
		private void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e) {
			var wpfTextView = sender as IWpfTextView;
			if (wpfTextView == null || !_sessionService.IsReady) return;
			if (wpfTextView.InLayout || wpfTextView.IsClosed) {
				return;
			}

			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
				Log.Verbose(@"TextDocument not found");
				return;
			}

			if (!wpfTextView.Properties.TryGetProperty(PropertyNames.DocumentMarkerManager, out DocumentMarkerManager documentMarkerManager)
				|| documentMarkerManager == null) {
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
				try {
					var visibleRangeSubject = wpfTextView.Properties
						.GetProperty<Subject<HostDidChangeEditorVisibleRangesNotificationSubject>>(PropertyNames
							.HostDidChangeEditorVisibleRangesNotificationSubject);
					visibleRangeSubject?.OnNext(
						new HostDidChangeEditorVisibleRangesNotificationSubject(wpfTextView,
							textDocument.FilePath.ToUri()));
				}
				catch (InvalidOperationException ex) {
					Log.Warning(ex, nameof(OnTextViewLayoutChanged));
				}
				catch (Exception ex) {
					Log.Error(ex, nameof(OnTextViewLayoutChanged));
				}
			}

			wpfTextView
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
