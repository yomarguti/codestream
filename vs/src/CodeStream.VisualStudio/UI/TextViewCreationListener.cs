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
using System.Threading;
using CodeStream.VisualStudio.UI.Extensions;
using Microsoft.VisualStudio.Shell;

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
		private IWpfTextView _focusedWpfTextView;
		private static readonly object InitializedLock = new object();

		internal const string LayerName = "CodeStreamHighlightColor";

		private static readonly object WeakTableLock = new object();
		private static readonly ConditionalWeakTable<ITextBuffer, HashSet<IWpfTextView>> TextBufferTable =
			new ConditionalWeakTable<ITextBuffer, HashSet<IWpfTextView>>();

		[Import]
		public ICodeStreamAgentServiceFactory CodeStreamAgentServiceFactory { get; set; }
		[Import]
		public ICodeStreamService CodeStreamService { get; set; }
		[Import]
		public ISessionService SessionService { get; set; }
		[Import]
		public IEventAggregator EventAggregator { get; set; }
		[Import]
		public IEditorService EditorService { get; set; }
		[Import]
		public IWpfTextViewCache TextViewCache { get; set; }

		[Import] public IVsEditorAdaptersFactoryService EditorAdaptersFactoryService { get; set; }
		[Import] public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }
		[ImportMany] public IEnumerable<IWpfTextViewMarginProvider> TextViewMarginProviders { get; set; }

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

		/// <summary>
		/// SubjectBuffersConnected happens first
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="reason"></param>
		/// <param name="subjectBuffers"></param>
		public void SubjectBuffersConnected(IWpfTextView wpfTextView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers) {
			try {
				if (wpfTextView == null || !wpfTextView.HasValidRoles()) return;
				if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer,
					out var textDocument)) {
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
						() => new DocumentMarkerManager(CodeStreamAgentServiceFactory.Create(), wpfTextView, textDocument));
					wpfTextView.Properties.AddProperty(PropertyNames.TextViewFilePath, textDocument.FilePath);
					wpfTextView.Properties.AddProperty(PropertyNames.TextViewState, new TextViewState());
#if DEBUG
					if (TextViewCache == null) {
						Debugger.Break();
					}
#endif
					TextViewCache.Add(textDocument.FilePath, wpfTextView);
				}
				Log.Verbose($"{nameof(SubjectBuffersConnected)} FilePath={textDocument.FilePath}");
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(SubjectBuffersConnected));
			}
		}

		/// <summary>
		/// VsTextViewCreated is created after all margins, etc.
		/// </summary>
		/// <param name="textViewAdapter"></param>
		public void VsTextViewCreated(IVsTextView textViewAdapter) {
			try {
				var wpfTextView = EditorAdaptersFactoryService.GetWpfTextView(textViewAdapter);
				if (wpfTextView == null || !wpfTextView.HasValidRoles()) return;

				// find all of our textView margin providers (they should already have been created at this point)
				var textViewMarginProviders = TextViewMarginProviders
					.Where(_ => _ as ICodeStreamMarginProvider != null)
					.Select(_ => (_ as ICodeStreamMarginProvider)?.TextViewMargin)
					.Where(_ => _ != null)
					.ToList();

				if (!textViewMarginProviders.AnySafe()) {
					Log.LocalWarning($"No {nameof(textViewMarginProviders)}");
					return;
				}

				using (Log.CriticalOperation($"{nameof(VsTextViewCreated)}")) {
					wpfTextView.Properties.AddProperty(PropertyNames.TextViewMarginProviders, textViewMarginProviders);
					Debug.Assert(EventAggregator != null, nameof(EventAggregator) + " != null");
					
					var textViewLayoutChangedSubject = new Subject<TextViewLayoutChangedSubject>();
					var caretPositionChangedSubject = new Subject<CaretPositionChangedSubject>();
					var textSelectionChangedSubject = new Subject<TextSelectionChangedSubject>();
					//listening on the main thread since we have to change the UI state
					var disposables = new List<IDisposable>();
					disposables.Add(EventAggregator.GetEvent<SessionReadyEvent>()
							.ObserveOnApplicationDispatcher()
							.Subscribe(_ => {
								Log.Verbose($"{nameof(VsTextViewCreated)} SessionReadyEvent Session IsReady={SessionService.IsReady}");
								if (SessionService.IsReady) {
									OnSessionReady(wpfTextView);
								}
							}));
					disposables.Add(EventAggregator.GetEvent<SessionLogoutEvent>()
						.ObserveOnApplicationDispatcher()
						.Subscribe(_ => OnSessionLogout(wpfTextView, textViewMarginProviders)));
					disposables.Add(EventAggregator.GetEvent<MarkerGlyphVisibilityEvent>()
						.ObserveOnApplicationDispatcher()
						.Subscribe(_ => textViewMarginProviders.Toggle(_.IsVisible)));
					disposables.Add(EventAggregator.GetEvent<AutoHideMarkersEvent>()
						.ObserveOnApplicationDispatcher()
						.Subscribe(_ => textViewMarginProviders.SetAutoHideMarkers(_.Value)));
					disposables.Add(textViewLayoutChangedSubject.Throttle(TimeSpan.FromMilliseconds(100))
						.ObserveOnApplicationDispatcher()
						.Subscribe(subject => {
							_ = OnTextViewLayoutChangedSubjectHandlerAsync(subject);
						}));
					disposables.Add(caretPositionChangedSubject.Throttle(TimeSpan.FromMilliseconds(200))
						.ObserveOnApplicationDispatcher()
						.Subscribe(subject => {
							_ = OnCaretPositionChangedSubjectHandlerAsync(subject);
						}));
					disposables.Add(textSelectionChangedSubject.Throttle(TimeSpan.FromMilliseconds(200))
						.ObserveOnApplicationDispatcher()
						.Subscribe(subject => {
							_ = OnTextSelectionChangedSubjectHandlerAsync(subject);
						}));

					wpfTextView.Properties.AddProperty(PropertyNames.TextViewEvents, disposables);					
					wpfTextView.Properties.AddProperty(PropertyNames.TextViewLayoutChangedSubject, textViewLayoutChangedSubject);
					wpfTextView.Properties.AddProperty(PropertyNames.CaretPositionChangedSubject, caretPositionChangedSubject);
					wpfTextView.Properties.AddProperty(PropertyNames.TextSelectionChangedSubject, textSelectionChangedSubject);

					Log.Verbose($"{nameof(VsTextViewCreated)} Session IsReady={SessionService.IsReady}");

					if (SessionService.IsReady) {
						OnSessionReady(wpfTextView);
					}
					else {
						textViewMarginProviders.Hide();
					}

					ChangeActiveEditor(wpfTextView);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(VsTextViewCreated));
			}
		}

		public void SubjectBuffersDisconnected(IWpfTextView wpfTextView, ConnectionReason reason, Collection<ITextBuffer> subjectBuffers) {
			try {
				if (wpfTextView == null || !wpfTextView.HasValidRoles()) return;
				if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) return;

				lock (WeakTableLock) {
					// we need to check all buffers reported since we will be called after actual changes have happened.
					// for example, if content type of a buffer changed, we will be called after it is changed, rather than before it.
					foreach (var buffer in subjectBuffers) {
						if (TextBufferTable.TryGetValue(buffer, out HashSet<IWpfTextView> textViews)) {
							textViews.Remove(wpfTextView);
							TextViewCache.Remove(filePath, wpfTextView);

							if (textViews.Count == 0) {
								TextBufferTable.Remove(buffer);

								wpfTextView.LayoutChanged -= OnTextViewLayoutChanged;
								wpfTextView.Caret.PositionChanged -= Caret_PositionChanged;
								wpfTextView.GotAggregateFocus -= TextView_GotAggregateFocus;
								wpfTextView.Selection.SelectionChanged += Selection_SelectionChanged;

								wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewFilePath);
								wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewState);
								wpfTextView.Properties.RemovePropertySafe(PropertyNames.DocumentMarkers);
								wpfTextView.Properties.RemovePropertySafe(PropertyNames.DocumentMarkerManager);
								wpfTextView.Properties.RemovePropertySafe(PropertyNames.TextViewMarginProviders);
								wpfTextView.Properties.TryDisposeProperty<HighlightAdornmentManager>(PropertyNames.AdornmentManager);

								wpfTextView.Properties.TryDisposeProperty<Subject<TextViewLayoutChangedSubject>>(PropertyNames.TextViewLayoutChangedSubject);
								wpfTextView.Properties.TryDisposeProperty<Subject<CaretPositionChangedSubject>>(PropertyNames.CaretPositionChangedSubject);								
								wpfTextView.Properties.TryDisposeProperty<Subject<TextSelectionChangedSubject>>(PropertyNames.TextSelectionChangedSubject);

								wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewEvents);
								wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);
								Log.Verbose($"{nameof(SubjectBuffersDisconnected)} FilePath={filePath}");
							}
						}
					}

					if (TextViewCache.Count() == 0) {
						ResetActiveEditor();
					}
				}
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(SubjectBuffersDisconnected));
			}
		}

		public void OnSessionReady(IWpfTextView wpfTextView) {
			try {
				if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state)) return;

				Log.Verbose($"{nameof(OnSessionReady)} state={state?.Initialized}");
				// ReSharper disable InvertIf
				if (state != null && !state.Initialized) {
					lock (InitializedLock) {
						if (!state.Initialized) {
							Log.Verbose($"{nameof(OnSessionReady)} state=initializing");

							wpfTextView.Properties.AddProperty(PropertyNames.AdornmentManager, new HighlightAdornmentManager(wpfTextView));
							wpfTextView.Properties.AddProperty(PropertyNames.TextViewLocalEvents,
								new List<IDisposable> {
									EventAggregator.GetEvent<DocumentMarkerChangedEvent>()
										.Subscribe(_ => {
											Log.Verbose($"{nameof(DocumentMarkerChangedEvent)} State={state.Initialized}, _={_?.Uri}");
											OnDocumentMarkerChanged(wpfTextView, _);
										})
								});

							if (wpfTextView.Properties.TryGetProperty(PropertyNames.DocumentMarkerManager, out DocumentMarkerManager documentMarkerManager)
								&& documentMarkerManager != null) {
								if (!documentMarkerManager.IsInitialized()) {
									documentMarkerManager.TrySetMarkers(true);
								}
							}

							wpfTextView
								.Properties
								.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
								.OnSessionReady();

							// keep this at the end -- we want this to be the first handler
							wpfTextView.LayoutChanged += OnTextViewLayoutChanged;
							wpfTextView.Caret.PositionChanged += Caret_PositionChanged;
							wpfTextView.GotAggregateFocus += TextView_GotAggregateFocus;
							wpfTextView.Selection.SelectionChanged += Selection_SelectionChanged;

							state.Initialized = true;

							ChangeActiveEditor(wpfTextView);
						}
					}
				}
				// ReSharper restore InvertIf
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(OnSessionReady)}");
			}
		}

		private void ResetActiveEditor() {
			try {
				_ = CodeStreamService.ResetActiveEditorAsync();
				_focusedWpfTextView = null;
				SessionService.LastActiveFileUrl = null;
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(ResetActiveEditor));
			}
		}

		private void ChangeActiveEditor(IWpfTextView wpfTextView) {
			try {
				if (wpfTextView == null || !SessionService.IsWebViewVisible) return;
				if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) return;
				if (filePath.IsNullOrWhiteSpace()) return;

				var activeTextEditor = EditorService.GetActiveTextEditor(TextDocumentFactoryService, wpfTextView);
				if (activeTextEditor != null && activeTextEditor.Uri != null) {
					if (Uri.TryCreate(filePath, UriKind.RelativeOrAbsolute, out Uri result)) {
						if (activeTextEditor.Uri.EqualsIgnoreCase(result)) {
							_ = CodeStreamService.ChangeActiveEditorAsync(new Uri(filePath), activeTextEditor);
						}
					}
				}
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(ChangeActiveEditor));
			}
		}

		private void OnSessionLogout(IWpfTextView wpfTextView, List<ICodeStreamWpfTextViewMargin> textViewMarginProviders) {
			try {
				if (wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewState, out TextViewState state)) {
					state.Initialized = false;
				}

				wpfTextView.Properties.TryDisposeListProperty(PropertyNames.TextViewLocalEvents);
				wpfTextView.Properties.TryDisposeProperty<HighlightAdornmentManager>(PropertyNames.AdornmentManager);
				wpfTextView.LayoutChanged -= OnTextViewLayoutChanged;
				wpfTextView.Caret.PositionChanged -= Caret_PositionChanged;
				wpfTextView.Selection.SelectionChanged += Selection_SelectionChanged;
				wpfTextView.GotAggregateFocus -= TextView_GotAggregateFocus;

				if (wpfTextView.Properties.TryGetProperty(PropertyNames.DocumentMarkerManager,
					out DocumentMarkerManager manager)) {
					manager.Reset();
				}

				textViewMarginProviders.OnSessionLogout();
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnSessionLogout));
			}
		}

		private void OnDocumentMarkerChanged(IWpfTextView wpfTextView, DocumentMarkerChangedEvent e) {
			Debug.WriteLine($"{nameof(OnDocumentMarkerChanged)}");

			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
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

					wpfTextView
						.Properties
						.GetProperty<DocumentMarkerManager>(PropertyNames.DocumentMarkerManager)
						.TrySetMarkers(true);

					wpfTextView
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

		#region EventHandlers

		private void Caret_PositionChanged(object sender, CaretPositionChangedEventArgs e) {
			if (e.TextView == null || !SessionService.IsReady || !SessionService.IsWebViewVisible || !SessionService.IsCodemarksForFileVisible) return;
			var wpfTextView = e.TextView as IWpfTextView;
			if (wpfTextView == null) return;

			wpfTextView
				.Properties
				.GetProperty<Subject<CaretPositionChangedSubject>>(PropertyNames.CaretPositionChangedSubject)
				?.OnNext(new CaretPositionChangedSubject(wpfTextView, sender, e));
		}

		private void Selection_SelectionChanged(object sender, EventArgs e) {
			if (!SessionService.IsReady || !SessionService.IsWebViewVisible) return;

			var textSelection = sender as ITextSelection;
			if (textSelection == null || textSelection.IsEmpty) return;

			var wpfTextView = textSelection.TextView as IWpfTextView;

			wpfTextView
				.Properties
				.GetProperty<Subject<TextSelectionChangedSubject>>(PropertyNames.TextSelectionChangedSubject)
				?.OnNext(new TextSelectionChangedSubject(wpfTextView, textSelection));
		}

		private void TextView_GotAggregateFocus(object sender, EventArgs e) {
			if (!(sender is IWpfTextView wpfTextView)) return;
			Debug.WriteLine(nameof(TextView_GotAggregateFocus));

			if (_focusedWpfTextView == null || _focusedWpfTextView != wpfTextView) {
				ChangeActiveEditor(wpfTextView);
				_focusedWpfTextView = wpfTextView;

				if (wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) {
					SessionService.LastActiveFileUrl = filePath;
				}
			}
		}

		private void OnTextViewLayoutChanged(object sender, TextViewLayoutChangedEventArgs e) {
			try {
				if (!(sender is IWpfTextView wpfTextView) || !SessionService.IsReady) return;
				if (wpfTextView.InLayout || wpfTextView.IsClosed) return;

				// don't trigger for changes that don't result in lines being added or removed
				var triggerTextViewLayoutChanged = (e.VerticalTranslation ||
													 e.NewViewState.ViewportTop != e.OldViewState.ViewportTop ||
													 e.NewViewState.ViewportBottom != e.OldViewState.ViewportBottom) &&
													SessionService.IsWebViewVisible && SessionService.IsCodemarksForFileVisible;

				var requiresMarkerCheck = false;
				if (wpfTextView.Properties.TryGetProperty(PropertyNames.DocumentMarkerManager, out DocumentMarkerManager documentMarkerManager) && documentMarkerManager != null) {
					var hasTranslatedLines = e.TranslatedLines.Any();
					var hasNewOrReformattedLines = e.NewOrReformattedLines.Any();

					// get markers if it's null (first time) or we did something that isn't scrolling/vertical changes
					// backspace has a NewOrReformatted Count of 1 :)
					// ENTER-ing beyond the viewport results in e.VerticalTranslation && hasNewOrReformattedLines
					if ((e.VerticalTranslation && hasNewOrReformattedLines) || (hasTranslatedLines && hasNewOrReformattedLines && e.NewOrReformattedLines.Any()) || !documentMarkerManager.IsInitialized()) {
						requiresMarkerCheck = true;
					}
					else if ((e.VerticalTranslation || hasTranslatedLines) && documentMarkerManager.HasMarkers()) {
						triggerTextViewLayoutChanged = true;
					}
				}

				if (triggerTextViewLayoutChanged || requiresMarkerCheck) {
					try {
						wpfTextView.Properties
							.GetProperty<Subject<TextViewLayoutChangedSubject>>(PropertyNames.TextViewLayoutChangedSubject)
							?.OnNext(new TextViewLayoutChangedSubject(wpfTextView, sender, e) {
								RequiresMarkerCheck = requiresMarkerCheck,
								TriggerTextViewLayoutChanged = triggerTextViewLayoutChanged
							});
					}
					catch (InvalidOperationException ex) {
						Log.Error(ex, nameof(OnTextViewLayoutChanged));
					}
				}
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(OnTextViewLayoutChanged));
			}
		}

		#endregion

		#region SubjectHandlers

		private async System.Threading.Tasks.Task OnTextSelectionChangedSubjectHandlerAsync(TextSelectionChangedSubject subject) {
			try {
				Debug.WriteLine($"{nameof(OnTextSelectionChangedSubjectHandlerAsync)} {subject.TextSelection.ToPositionString()}");
				var wpfTextView = subject.WpfTextView;
				var activeEditorState = EditorService?.GetEditorState(wpfTextView);

				_ = CodeStreamService.EditorSelectionChangedNotificationAsync(
					wpfTextView.Properties.GetProperty<string>(PropertyNames.TextViewFilePath).ToUri(),
					activeEditorState,
					wpfTextView.ToVisibleRangesSafe(),
					wpfTextView?.TextSnapshot?.LineCount,
					CodemarkType.Comment, CancellationToken.None);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(OnTextSelectionChangedSubjectHandlerAsync));
			}
		}

		private async System.Threading.Tasks.Task OnCaretPositionChangedSubjectHandlerAsync(CaretPositionChangedSubject e) {
			try {
				if (e == null || e.EventArgs == null) return;
				
				var wpfTextView = e.WpfTextView;
				if (wpfTextView == null || !SessionService.IsReady || !SessionService.IsWebViewVisible || !SessionService.IsCodemarksForFileVisible) return;
				if (!wpfTextView.Properties.TryGetProperty(PropertyNames.TextViewFilePath, out string filePath)) return;
				if (filePath.IsNullOrWhiteSpace()) return;
				if (!Uri.TryCreate(filePath, UriKind.RelativeOrAbsolute, out Uri result)) return;

				Debug.WriteLine($"{nameof(OnCaretPositionChangedSubjectHandlerAsync)} new={e.EventArgs.NewPosition} old={e.EventArgs.OldPosition}");
				var cursorLine = wpfTextView.TextSnapshot.GetLineFromPosition(e.EventArgs.NewPosition.BufferPosition.Position);
				_ = CodeStreamService.ChangeCaretAsync(result, wpfTextView.ToVisibleRangesSafe(), cursorLine.LineNumber, wpfTextView.TextSnapshot.LineCount);
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(OnCaretPositionChangedSubjectHandlerAsync));
			}
		}

		private async System.Threading.Tasks.Task OnVisibleRangesSubjectHandlerAsync(Uri uri, IWpfTextView wpfTextView) {
			try {
				if (wpfTextView.InLayout || wpfTextView.IsClosed) return;

				_ = CodeStreamService.BrowserService?.NotifyAsync(
					new HostDidChangeEditorVisibleRangesNotificationType {
						Params = new HostDidChangeEditorVisibleRangesNotification(
							uri,
							EditorService.GetEditorState(wpfTextView)?.ToEditorSelectionsSafe(),
							wpfTextView.ToVisibleRangesSafe(),
							wpfTextView.TextSnapshot?.LineCount
						)
					});
			}
			catch (InvalidOperationException ex) {
				Log.Warning(ex, nameof(OnVisibleRangesSubjectHandlerAsync));
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(OnVisibleRangesSubjectHandlerAsync));
			}
			await System.Threading.Tasks.Task.CompletedTask;
		}

		private async System.Threading.Tasks.Task OnTextViewLayoutChangedSubjectHandlerAsync(TextViewLayoutChangedSubject subject) {
			try {
				Debug.WriteLine($"{nameof(OnTextViewLayoutChangedSubjectHandlerAsync)} RequiresMarkerCheck={subject.RequiresMarkerCheck} TriggerTextViewLayoutChanged={subject.TriggerTextViewLayoutChanged}");

				var wpfTextView = subject.WpfTextView;
				if (TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextView.TextBuffer, out var textDocument)) {
					// don't trigger for changes that don't result in lines being added or removed

					if (wpfTextView.Properties.TryGetProperty(PropertyNames.DocumentMarkerManager, out DocumentMarkerManager documentMarkerManager) && documentMarkerManager != null) {
						// get markers if it's null (first time) or we did something that isn't scrolling/vertical changes
						if (subject.RequiresMarkerCheck) {
							var updated = await documentMarkerManager.TrySetMarkersAsync();
							if (updated) {
								subject.TriggerTextViewLayoutChanged = true;
							}
						}
					}
					if (subject.TriggerTextViewLayoutChanged) {
						//only send this if we have an actual change						
						try {
							if (wpfTextView.InLayout || wpfTextView.IsClosed) return;

							await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

							_ = OnVisibleRangesSubjectHandlerAsync(textDocument.FilePath.ToUri(), wpfTextView);

							wpfTextView
								.Properties
								.GetProperty<List<ICodeStreamWpfTextViewMargin>>(PropertyNames.TextViewMarginProviders)
								.OnTextViewLayoutChanged(subject.Sender, subject.EventArgs);
						}
						catch (InvalidOperationException ex) {
							Log.Warning(ex, nameof(OnTextViewLayoutChangedSubjectHandlerAsync));
						}
						catch (Exception ex) {
							Log.Error(ex, nameof(OnTextViewLayoutChangedSubjectHandlerAsync));
						}
					}
				}
			}
			catch (Exception ex) {
				Log.Warning(ex, nameof(OnTextViewLayoutChanged));
			}

			await System.Threading.Tasks.Task.CompletedTask;
		}

		#endregion

		#region Models

		class TextViewState {
			public bool Initialized { get; set; }
		}

		internal class TextViewLayoutChangedSubject {
			public TextViewLayoutChangedSubject(IWpfTextView wpfTextView, object sender,
				TextViewLayoutChangedEventArgs e) {
				WpfTextView = wpfTextView;
				Sender = sender;
				EventArgs = e;
			}

			public IWpfTextView WpfTextView { get; }
			public object Sender { get; }
			public TextViewLayoutChangedEventArgs EventArgs { get; }
			public bool RequiresMarkerCheck { get; set; }
			public bool TriggerTextViewLayoutChanged { get; set; }
		}

		internal class TextSelectionChangedSubject {
			public TextSelectionChangedSubject(IWpfTextView wpfTextView, ITextSelection textSelection) {
				WpfTextView = wpfTextView;
				TextSelection = textSelection;
			}

			public ITextSelection TextSelection { get; }

			public IWpfTextView WpfTextView { get; }
		}

		internal class CaretPositionChangedSubject {
			public CaretPositionChangedSubject(IWpfTextView wpfTextView, object sender, CaretPositionChangedEventArgs e) {
				WpfTextView = wpfTextView;
				Sender = sender;
				EventArgs = e;
			}

			public IWpfTextView WpfTextView { get; }
			public object Sender { get; }
			public CaretPositionChangedEventArgs EventArgs { get; }			
		}

		#endregion
	}
}
