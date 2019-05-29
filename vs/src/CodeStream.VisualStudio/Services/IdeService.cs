using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Logging.Instrumentation;
using CodeStream.VisualStudio.Extensions;
using EnvDTE;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows;
using CodeStream.VisualStudio.Packages;
using IComponentModel = Microsoft.VisualStudio.ComponentModelHost.IComponentModel;
using ILogger = Serilog.ILogger;
using System.IO;
using System.Text;
using Microsoft;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Text.Differencing;

namespace CodeStream.VisualStudio.Services {
	public enum ExtensionKind {
		LiveShare
	}

	public interface IIdeService {
		/// <summary>
		/// Uses built in process handler for navigating to an external url
		/// </summary>
		/// <param name="url">an absolute url</param>
		void Navigate(string url);
		System.Threading.Tasks.Task SetClipboardAsync(string text);
		void ScrollEditor(Uri fileUri, int? scrollTo = null, int? deltaPixels = null, bool? atTop = false);
		System.Threading.Tasks.Task<bool> OpenEditorAndRevealAsync(Uri fileUri, int? scrollTo = null, bool? atTop = false, bool? focus = false);
		System.Threading.Tasks.Task<IWpfTextView> OpenEditorAtLineAsync(Uri fileUri, Range range, bool forceOpen = false);
		//bool QueryExtensions(string author, params string[] names);
		bool QueryExtension(ExtensionKind extensionKind);
		bool TryStartLiveShare();
		bool TryJoinLiveShare(string url);
		System.Threading.Tasks.Task GetClipboardTextValueAsync(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null);

		void CompareFiles(string filePath1, string filePath2, ITextBuffer file2Replacement, Span location, string content, bool removeFile1 = false, bool removeFile2 = false);
		string CreateTempFile(string originalFilePath, string content);
		//	string CreateDiffTempFile(string originalFile, string content, Range range);
		void RemoveTempFileSafe(string fileName);
	}

	[Export(typeof(IIdeService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class IdeService : IIdeService {
		private static readonly ILogger Log = LogManager.ForContext<IdeService>();

		private readonly IServiceProvider _serviceProvider;
		private readonly IComponentModel _componentModel;

		private readonly Dictionary<ExtensionKind, bool> _extensions;

		[ImportingConstructor]
		public IdeService([Import(typeof(SVsServiceProvider))]IServiceProvider serviceProvider) {
			try {
				_serviceProvider = serviceProvider;
				_componentModel = serviceProvider?.GetService(typeof(SComponentModel)) as IComponentModel;
				_extensions = ExtensionManager.Initialize(LogManager.ForContext<ExtensionManagerDummy>()).Value;
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(IdeService));
			}
		}

		public IdeService() {
			//unit testing ctor
		}

		public async System.Threading.Tasks.Task<bool> OpenEditorAndRevealAsync(Uri fileUri, int? scrollTo = null, bool? atTop = false, bool? focus = false) {
			using (Log.CriticalOperation($"{nameof(OpenEditorAndRevealAsync)} {fileUri} scrollTo={scrollTo}")) {
				if (scrollTo == null) return false;

				var scrollToLine = scrollTo.Value;
				try {
					var wpfTextView = await AssertWpfTextViewAsync(fileUri);
					if (wpfTextView != null) {
						if (atTop == true) {
							ScrollViewportVerticallyByPixels(wpfTextView, scrollToLine);
						}
						else {
							EnsureTargetSpanVisible(wpfTextView, scrollToLine);
						}

						if (focus == true) {
							wpfTextView.VisualElement.Focus();
						}
					}
					return true;
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(OpenEditorAndRevealAsync)} failed for {fileUri}");
					return false;
				}
			}
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="fileUri"></param>
		/// <param name="range"></param>
		/// <param name="forceOpen"></param>
		/// <returns></returns>
		public async System.Threading.Tasks.Task<IWpfTextView> OpenEditorAtLineAsync(Uri fileUri, Range range, bool forceOpen = false) {
			using (Log.CriticalOperation($"{nameof(OpenEditorAtLineAsync)} {fileUri} range={range?.Start?.Line}, {range?.End?.Line}")) {
				try {
					var wpfTextView = await AssertWpfTextViewAsync(fileUri, forceOpen);
					if (wpfTextView != null) {
						var span = EnsureSnapshotSpanVisible(wpfTextView, range);
						if (span != null) {
							wpfTextView.Caret.MoveTo(new SnapshotPoint(wpfTextView.TextSnapshot, span.Value.Start + range.Start.Character));
							wpfTextView.Caret.EnsureVisible();
						}
						return wpfTextView;
					}
					return null;
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(OpenEditorAtLineAsync)} failed for {fileUri}");
					return null;
				}
			}
		}

		/// <summary>
		/// Scrolls an editor, only if it is already open
		/// </summary>
		/// <param name="fileUri"></param>
		/// <param name="scrollTo"></param>
		/// <param name="atTop"></param>
		public void ScrollEditor(Uri fileUri, int? scrollTo = null, int? deltaPixels = null, bool? atTop = false) {
			if (scrollTo == null || scrollTo.Value < 0) return;

			using (var metrics = Log.WithMetrics($"{nameof(ScrollEditor)} {fileUri} scrollTo={scrollTo} atTop={atTop}")) {
				try {
					var localPath = fileUri.ToLocalPath();
					var textViewCache = _componentModel.GetService<IWpfTextViewCache>();
					if (!textViewCache.TryGetValue(localPath, out var wpfTextView) || wpfTextView == null) return;

					if (deltaPixels != null) {
						wpfTextView.ViewScroller.ScrollViewportVerticallyByPixels(-deltaPixels.Value);
						return;
					}

					var scrollToLine = scrollTo.Value;

					if (atTop == true) {
						using (metrics.Measure("ScrollViewportVerticallyByPixels")) {
							ScrollViewportVerticallyByPixels(wpfTextView, scrollToLine);
						}
					}
					else {
						EnsureTargetSpanVisible(wpfTextView, scrollToLine);
					}
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(ScrollEditor)} failed for {fileUri}");
				}
			}
		}

		private async System.Threading.Tasks.Task<IWpfTextView> AssertWpfTextViewAsync(Uri fileUri, bool forceOpen = false) {
			var localPath = fileUri.ToLocalPath();

			var textViewCache = _componentModel.GetService<IWpfTextViewCache>();
			if (forceOpen == true || !textViewCache.TryGetValue(localPath, out var wpfTextView)) {
				var view = _componentModel.GetService<IEditorService>().GetActiveTextEditor();
				if (view == null || !view.Uri.EqualsIgnoreCase(fileUri)) {
					await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
					var dte = _serviceProvider.GetService(typeof(DTE)) as DTE;
					if (dte == null) {
						Log.Error($"{nameof(dte)} is null for {fileUri}");
						return null;
					}

					EnvDTE.Window window = dte.ItemOperations.OpenFile(localPath, EnvDTE.Constants.vsViewKindCode);
					// the TextView/WpfTextView may not be immediately available -- try to get it.
					wpfTextView = TryGetPendingWpfTextView(localPath);
				}
				else {
					wpfTextView = view?.WpfTextView;
				}
			}

			return wpfTextView;
		}

		private void EnsureTargetSpanVisible(IWpfTextView wpfTextView, int scrollToLine) {
			var lines = wpfTextView.VisualSnapshot.Lines;
			var startLine = lines.FirstOrDefault(_ => _.LineNumber == scrollToLine);
			if (startLine == null) {
				Log.Warning($"{nameof(EnsureTargetSpanVisible)} failed for line={scrollToLine}");
				return;
			}
			var span = new SnapshotSpan(wpfTextView.TextSnapshot, Span.FromBounds(startLine.Start, Math.Min(startLine.Start + 1, wpfTextView.VisualSnapshot.Length)));
			wpfTextView.ViewScroller.EnsureSpanVisible(span, EnsureSpanVisibleOptions.MinimumScroll);
		}

		private SnapshotSpan? EnsureSnapshotSpanVisible(IWpfTextView wpfTextView, Range range) {
			if (range == null) return null;

			var lines = GetStartAndEndLines(wpfTextView, range.Start.Line, range.End.Line);
			if (lines == null) return null;

			var span = new SnapshotSpan(wpfTextView.TextSnapshot, Span.FromBounds(lines.Item1.Start, lines.Item2.End));
			wpfTextView.ViewScroller.EnsureSpanVisible(span, EnsureSpanVisibleOptions.AlwaysCenter);
			return span;
		}

		private Tuple<ITextSnapshotLine, ITextSnapshotLine> GetStartAndEndLines(IWpfTextView wpfTextView, int startLine, int endLine) {
			ITextSnapshotLine start = null;
			ITextSnapshotLine end = null;
			foreach (var line in wpfTextView.VisualSnapshot.Lines) {
				if (line.LineNumber == startLine) {
					start = line;
				}
				if (line.LineNumber == endLine) {
					end = line;
				}
			}
			if (start != null && end != null) {
				return Tuple.Create(start, end);
			}
			return null;
		}

		/// <summary>
		/// This can be abysmally slow. Moves the target scrollToLine to the top of the editor
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="scrollToLine"></param>
		private void ScrollViewportVerticallyByLines(IWpfTextView wpfTextView, int scrollToLine) {
			var firstTextViewLine = wpfTextView.TextViewLines.FirstOrDefault();
			var startingVisibleLineNumber = wpfTextView.TextSnapshot.GetLineNumberFromPosition(firstTextViewLine.Extent.Start.Position);
			var lineCount = startingVisibleLineNumber - scrollToLine;
			wpfTextView.ViewScroller.ScrollViewportVerticallyByLines(lineCount < 0 ? ScrollDirection.Down : ScrollDirection.Up, Math.Abs(lineCount));
		}

		/// <summary>
		/// Moves the target scrollToLine to the top of the editor
		/// </summary>
		/// <param name="wpfTextView"></param>
		/// <param name="scrollToLine"></param>
		private void ScrollViewportVerticallyByPixels(IWpfTextView wpfTextView, int scrollToLine) {
			var firstTextViewLine = wpfTextView.TextViewLines.FirstOrDefault();
			int startingVisibleLineNumber = wpfTextView.TextSnapshot.GetLineNumberFromPosition(firstTextViewLine.Extent.Start.Position);
			wpfTextView.ViewScroller.ScrollViewportVerticallyByPixels((startingVisibleLineNumber - scrollToLine + 1) * wpfTextView.LineHeight);
		}

		//public EditorState GetActiveEditorState() {
		//	return GetActiveEditorState(out IVsTextView textView);
		//}

		// someday, this can return...
		//public bool QueryExtensions(string author, params string[] names)
		//{
		//    if (_extensionManager == null)
		//    {
		//        Log.Debug($"{nameof(_extensionManager)} is null");
		//        return false;
		//    }

		//    foreach (var extension in _extensionManager.GetInstalledExtensions())
		//    {
		//        IExtensionHeader header = extension.Header;
		//        if (!header.SystemComponent &&
		//            header.Author.EqualsIgnoreCase(author) && names.Any(_ => _.EqualsIgnoreCase(header.Name)))
		//        {
		//            return true;
		//        }
		//    }
		//    return false;
		//}

		/// <summary>
		/// Tries to get an active text view for a file that may have just opened.
		/// Uses a naive exponential backoff algorithm against the IsDocumentOpen VSShell utility
		/// </summary>
		/// <param name="filePath"></param>
		/// <returns></returns>
		/// <remarks>https://stackoverflow.com/a/7373385/208022</remarks>
		internal IWpfTextView TryGetPendingWpfTextView(string filePath) {
			var editorAdapterFactoryService = _componentModel.GetService<IVsEditorAdaptersFactoryService>();
			IVsUIHierarchy uiHierarchy;
			uint itemID;
			IVsWindowFrame windowFrame = null;

			if (Retry.WithExponentialBackoff(() => {
				if (VsShellUtilities.IsDocumentOpen(
				  _serviceProvider,
				  filePath,
				  Guid.Empty,
				  out uiHierarchy,
				  out itemID,
				  out windowFrame)) {
					return true;
				}
				return false;

			})) {
				if (windowFrame == null) return null;

				IVsTextView view = VsShellUtilities.GetTextView(windowFrame);
				Log.Verbose($"{nameof(TryGetPendingWpfTextView)} found for {filePath}");
				return editorAdapterFactoryService.GetWpfTextView(view);
			}

			return null;
		}

		public bool QueryExtension(ExtensionKind extensionKind) {
			if (_extensions == null) return false;

			return _extensions.TryGetValue(extensionKind, out bool value) && value;
		}

		public bool TryStartLiveShare() {
			ThreadHelper.ThrowIfNotOnUIThread();

			try {
				ExecuteCommand("LiveShare.ShareWorkspace");
				return true;
			}
			catch (Exception ex) {
				Log.Error(ex, "Could not start Live Share");
			}

			return false;
		}

		public bool TryJoinLiveShare(string url) {
			ThreadHelper.ThrowIfNotOnUIThread();

			if (url.IsNullOrWhiteSpace()) {
				Log.Warning("Live Share Url is missing");
				return false;
			}

			try {
				ExecuteCommand("LiveShare.JoinWorkspace", $"/Root {url}");
				return true;
			}
			catch (Exception ex) {
				Log.Error(ex, "Could not join Live Share Url={Url}", url);
			}

			return false;
		}


		/// <summary>
		/// Uses built in process handler for navigating to an external url
		/// </summary>
		/// <param name="url">an absolute url</param>
		public void Navigate(string url) {
			if (url.IsNullOrWhiteSpace()) {
				Log.Warning("Url is missing");
				return;
			}

			System.Diagnostics.Process.Start(url);
		}

		public System.Threading.Tasks.Task SetClipboardAsync(string text) {
			var thread = new System.Threading.Thread(() => Clipboard.SetText(text));
			thread.SetApartmentState(ApartmentState.STA); //Set the thread to STA
			thread.Start();
			thread.Join();

			return System.Threading.Tasks.Task.CompletedTask;
		}

		public async System.Threading.Tasks.Task GetClipboardTextValueAsync(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null) {
			if (callback == null) await System.Threading.Tasks.Task.CompletedTask;

			var workerTask = System.Threading.Tasks.Task.Run(() => {
				var magicNumber = (int)Math.Round(Math.Sqrt(millisecondsTimeout));
				Exception threadEx = null;
				string result = null;
				System.Threading.Thread staThread = null;
				staThread = new System.Threading.Thread(
					  delegate (object state) {
						  for (var i = 0; i < magicNumber + 1; i++) {
							  try {
								  var textString = Clipboard.GetDataObject()?.GetData(DataFormats.Text) as string;
								  if (millisecondsTimeout > 0) {
									  if (clipboardMatcher != null) {
										  if (textString != null && clipboardMatcher.IsMatch(textString)) {
											  result = textString;
											  break;
										  }
									  }
									  else {
										  result = textString;
										  break;
									  }
								  }
								  else {
									  result = textString;
									  break;
								  }

								  System.Threading.Thread.Sleep(magicNumber);
							  }
							  catch (Exception ex) {
								  threadEx = ex;
							  }
						  }
					  });

				staThread.SetApartmentState(ApartmentState.STA);
				staThread.Start();
				staThread.Join();
				callback?.Invoke(result);
			});

			try {
				await workerTask;
			}
			catch (OperationCanceledException) {
				await System.Threading.Tasks.Task.CompletedTask;
			}
		}

		////must be "" rather than null...
		private void ExecuteCommand(string commandName, string commandArgs = "") {
			ThreadHelper.ThrowIfNotOnUIThread();
			Log.Verbose("ExecuteCommand={CommandName} CommandArgs={commandArgs}", commandName, commandArgs);
			var dte = _serviceProvider.GetService(typeof(DTE)) as DTE;
			if (dte == null) throw new ArgumentNullException(nameof(dte));
			dte.ExecuteCommand(commandName, commandArgs);
			Log.Debug("ExecuteCommand={CommandName} CommandArgs={commandArgs} Success", commandName, commandArgs);
		}

		/// <summary>
		/// https://stackoverflow.com/questions/518701/clipboard-gettext-returns-null-empty-string
		/// </summary>
		/// <remarks>Only works when apartmentState is STA</remarks>
		/// <returns></returns>
		public string GetClipboardText() {
			IDataObject idat = null;
			// ReSharper disable once NotAccessedVariable
			Exception threadEx = null;
			object text = "";
			System.Threading.Thread staThread = new System.Threading.Thread(
				delegate () {
					try {
						idat = Clipboard.GetDataObject();
						text = idat?.GetData(DataFormats.Text);
					}
					catch (Exception ex) {
						threadEx = ex;
					}
				});
			staThread.SetApartmentState(ApartmentState.STA);
			staThread.Start();
			staThread.Join();

			return text as string;
		}

		private static readonly Encoding VsDefaultEncoding = new UTF8Encoding(true);

		private string CreateTempFile(string fileName) {
			try {
				var name = Path.GetFileName(fileName);
				if (name == null) return null;
				var path = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
				Directory.CreateDirectory(path); // Ensure temp path exists.
				var tempFile = Path.Combine(path, name);
				Log.Verbose($"Created temp file {tempFile}");
				return tempFile;
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(CreateTempFile));
			}

			return null;
		}

		//public string CreateDiffTempFile(string originalFilePath, string patchContent, Range range) {
		//	try {
		//		var tempFile = CreateTempFile(originalFilePath);
		//		if (tempFile == null) return null;

		//		using (var fs = File.OpenRead(originalFilePath))
		//		using (var reader = new StreamReader(fs, Encoding.UTF8, true)) {
		//			reader.Peek();
		//			// do some magic to get the encoding from the current file
		//			var encoding = reader.CurrentEncoding;
		//			using (var writer = new StreamWriter(tempFile, false, encoding)) {
		//				if (patchContent != null) {
		//					ProcessContent(reader, writer, range, patchContent);
		//				}
		//			}
		//		}

		//		return tempFile;
		//	}
		//	catch (Exception ex) {
		//		Log.Error(ex, nameof(CreateDiffTempFile));
		//	}

		//	return null;
		//}

		public string CreateTempFile(string originalFilePath, string content) {
			try {
				var tempFile = CreateTempFile(originalFilePath);
				if (tempFile == null) return null;

				using (var fs = File.OpenRead(originalFilePath))
				using (var reader = new StreamReader(fs, Encoding.UTF8, true)) {
					reader.Peek();
					// do some magic to get the encoding from the current file
					var encoding = reader.CurrentEncoding;
					using (var writer = new StreamWriter(tempFile, false, encoding)) {
						writer.Write(content);
					}
				}

				return tempFile;
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(CreateTempFile));
			}

			return null;
		}

		//public string ReplaceContent(string originalContent, string newContent, Range range) {
		//	var sb = new StringBuilder();
		//	using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(originalContent ?? "")))
		//	using (var sr = new StreamReader(ms, Encoding.UTF8, true)) {
		//		using (TextWriter tw = new StringWriter(sb)) {
		//			ProcessContent(sr, tw, range, newContent);
		//		}
		//	}
		//	return sb.ToString();
		//}

		//private static string NormalizeLineEndings(string source) {
		//	return source.Replace(Environment.NewLine, "\n").Replace("\n", Environment.NewLine);
		//}

		//private static void ProcessContent(StreamReader sr, TextWriter tw, Range range, string newContent) {
		//	string line;
		//	var index = 0;
		//	var normalizedNewContent = NormalizeLineEndings(newContent);
		//	var endsWithNewLine = normalizedNewContent.EndsWith(Environment.NewLine);
		//	while ((line = sr.ReadLine()) != null) {
		//		string newLine = null;
		//		bool addNewLine = false;
		//		if (index == range.Start.Line && index == range.End.Line) {
		//			newLine = line.Substring(0, range.Start.Character) + normalizedNewContent + line.Substring(range.End.Character, line.Length - range.End.Character);
		//			if (!endsWithNewLine) {
		//				addNewLine = true;
		//			}
		//		}
		//		else {
		//			if (index == range.Start.Line) {
		//				newLine = line.Remove(range.Start.Character) + normalizedNewContent;
		//				if (!endsWithNewLine) {
		//					addNewLine = true;
		//				}
		//			}
		//			else if (index > range.Start.Line && index < range.End.Line) {
		//				// this line is part of the inner range -- skip it!
		//			}
		//			else if (index == range.End.Line) {
		//				if (range.End.Character < line.Length) {
		//					var n = line.Remove(range.End.Character);
		//					if (n != string.Empty) {
		//						newLine = n;
		//					}
		//				}
		//			}
		//			else {
		//				newLine = line;
		//				if (!endsWithNewLine) {
		//					addNewLine = true;
		//				}
		//			}
		//		}

		//		//note: don't use File.AppendAllText, it opens the file every time and could take forever to run. Instead use StreamWriter 
		//		if (newLine != null) {
		//			tw.Write(newLine);
		//			if (addNewLine) {
		//				tw.Write(Environment.NewLine);
		//			}
		//		}

		//		index++;
		//	}
		//}

		/// <summary>
		/// Compares the contents of two files. Requires UI thread.
		/// </summary>
		/// <param name="filePath1"></param>
		/// <param name="filePath2"></param>
		/// <param name="content"></param>
		/// <param name="removeFile1OnCompletion"></param>
		/// <param name="removeFile2OnCompletion"></param>
		/// <param name="textBuffer"></param>
		/// <param name="span"></param>		
		public void CompareFiles(string filePath1, string filePath2, ITextBuffer textBuffer, Span span, string content, bool removeFile1OnCompletion = false, bool removeFile2OnCompletion = false) {
			ThreadHelper.ThrowIfNotOnUIThread();
			if (filePath1.IsNullOrWhiteSpace() || filePath2.IsNullOrWhiteSpace()) {
				if (filePath1.IsNullOrWhiteSpace()) {
					Log.Debug($"Missing {nameof(filePath1)}");
					return;
				}

				if (filePath2.IsNullOrWhiteSpace()) {
					Log.Debug($"Missing {nameof(filePath2)}");
					return;
				}
			}

			try {
				var diffService = (IVsDifferenceService)_serviceProvider.GetService(typeof(SVsDifferenceService));
				Assumes.Present(diffService);

				uint grfDiffOptions = 0;
				//don't use these options -- as it might seen like they should be useful, they actually break the diff
				//grfDiffOptions |= (uint)__VSDIFFSERVICEOPTIONS.VSDIFFOPT_LeftFileIsTemporary;
				//grfDiffOptions |= (uint)__VSDIFFSERVICEOPTIONS.VSDIFFOPT_RightFileIsTemporary;
				
				var frame = diffService.OpenComparisonWindow2(filePath1, filePath2,
					$"Your version vs Codemark version",
					filePath1 + Environment.NewLine + filePath2,
					filePath1,
					filePath2, null, null, grfDiffOptions);

				var diffViewer = GetDiffViewer(frame);
				var text = textBuffer.CurrentSnapshot.GetText();

				// why doesn't this work??? UGH
				//using (var edit = diffViewer.LeftView.TextBuffer.CreateEdit()) {
				//	if (edit.Delete(0, diffViewer.LeftView.TextBuffer.CurrentSnapshot.Length)) {
				//		if (edit.Insert(0, text)) {
				//			edit.Apply();
				//		}
				//	}
				//}

				using (var edit = diffViewer.RightView.TextBuffer.CreateEdit()) {
					//replace everything with the original buffer (it might have edits)
					if (edit.Delete(0, diffViewer.RightView.TextBuffer.CurrentSnapshot.Length)) {
						if (edit.Insert(0, text)) {
							edit.Apply();
						}
					}
				}

				using (var edit = diffViewer.RightView.TextBuffer.CreateEdit()) {
					// replace the span with the marker's code
					if (edit.Replace(span, content)) {
						edit.Apply();
					}
				}
				var documentRight = GetDocument(diffViewer.RightView.TextBuffer);
				if (documentRight.IsDirty) {
					documentRight.Save();
				}

				frame.Show();
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(CompareFiles));
			}
			finally {
				if (removeFile1OnCompletion) {
					RemoveTempFileSafe(filePath1);
				}
				if (removeFile2OnCompletion) {
					RemoveTempFileSafe(filePath2);
				}
			}
		}

		public static ITextDocument GetDocument(ITextBuffer textBuffer) {

			ITextDocument textDoc;
			var rc = textBuffer.Properties.TryGetProperty<ITextDocument>(typeof(ITextDocument), out textDoc);
			if (rc == true)
				return textDoc;
			else
				return null;
		}

		static IDifferenceViewer GetDiffViewer(IVsWindowFrame frame) {
			ThreadHelper.ThrowIfNotOnUIThread();
			return ErrorHandler.Succeeded(frame.GetProperty((int)__VSFPROPID.VSFPROPID_DocView, out object docView))
				? (docView as IVsDifferenceCodeWindow)?.DifferenceViewer : null;
		}

		public void RemoveTempFileSafe(string fileName) {
			try {
				Directory.Delete(Path.GetDirectoryName(fileName), true);
				Log.Verbose($"Removed temp file {fileName}");
			}
			catch (Exception ex) {
				Log.Warning(ex, $"Failed to remove temp file {fileName}");
			}
		}
	}
}
