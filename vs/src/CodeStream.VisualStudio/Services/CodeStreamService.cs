using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Threading;
using CodeStream.VisualStudio.UI.Extensions;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services {
	public interface ICodeStreamService {
		Task ResetActiveEditorAsync();
		Task ChangeActiveEditorAsync(Uri uri, ActiveTextEditor activeTextEditor = null);
		Task NewCodemarkAsync(Uri uri, Range range, CodemarkType codemarkType, string source, CancellationToken? cancellationToken = null);
		Task ShowCodemarkAsync(string codemarkId, string sourceUri, CancellationToken? cancellationToken = null);
		Task EditorSelectionChangedNotificationAsync(Uri uri,
			EditorState editorState,
			List<Range> visibleRanges,
			int? totalLines,
			CodemarkType codemarkType,
			CancellationToken? cancellationToken = null);
		Task OpenCommentByThreadAsync(string streamId, string threadId);
		/// <summary>
		/// logs the user out from the CodeStream agent and the session
		/// </summary>
		/// <returns></returns>
		//Task LogoutAsync();
		IBrowserService BrowserService { get; }
		bool IsReady { get; }
	}

	[Export(typeof(ICodeStreamService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class CodeStreamService : ICodeStreamService {
		private static readonly ILogger Log = LogManager.ForContext<CodeStreamService>();

		[Import]
		public ISessionService SessionService { get; set; }
		[Import]
		public IBrowserService BrowserService { get; set; }

		public bool IsReady => SessionService?.IsReady == true;

		public async Task ChangeActiveEditorAsync(Uri uri, ActiveTextEditor activeTextEditor = null) {
			if (IsReady) {
				try {
					var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
					Assumes.Present(componentModel);

					var editorService = componentModel.GetService<IEditorService>();
					activeTextEditor = activeTextEditor ?? editorService.GetActiveTextEditor(uri);
					var editorState = editorService.GetActiveEditorState();
					var fileName = uri.ToFileName() ?? uri.AbsolutePath;
					_ = BrowserService.NotifyAsync(new HostDidChangeActiveEditorNotificationType {
						Params = new HostDidChangeActiveEditorNotification {
							Editor = new HostDidChangeActiveEditorNotificationEditor(fileName,
							uri,
							editorState.ToEditorSelectionsSafe(),
							activeTextEditor?.WpfTextView.ToVisibleRangesSafe(),
							activeTextEditor?.TotalLines) {
								Metrics = ThemeManager.CreateEditorMetrics(activeTextEditor?.WpfTextView),
								LanguageId = null
							}
						}
					});
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(ChangeActiveEditorAsync)} Uri={uri}");
				}
			}

			await Task.CompletedTask;
		}

		public Task ResetActiveEditorAsync() {
			if (!IsReady) return Task.CompletedTask;

			try {
				_ = BrowserService.NotifyAsync(new HostDidChangeActiveEditorNotificationType {
					Params = new HostDidChangeActiveEditorNotificationBase()
				});
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(ChangeActiveEditorAsync)}");
			}
			return Task.CompletedTask;
		}

		public Task OpenCommentByThreadAsync(string streamId, string threadId) {
			if (!IsReady) return Task.CompletedTask;

			try {
				_ = BrowserService.NotifyAsync(new ShowStreamNotificationType {
					Params = new ShowStreamNotification {
						StreamId = streamId,
						ThreadId = threadId
					}
				});
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(OpenCommentByThreadAsync)} StreamId={streamId} ThreadId={threadId}");
			}

			return Task.CompletedTask;
		}

		public async Task ShowCodemarkAsync(string codemarkId, string sourceUri, CancellationToken? cancellationToken = null) {
			if (IsReady && !codemarkId.IsNullOrWhiteSpace()) {
				_ = BrowserService.NotifyAsync(new ShowCodemarkNotificationType {
					Params = new ShowCodemarkNotification {
						CodemarkId = codemarkId,
						SourceUri = sourceUri,
					}
				});
			}
			await Task.CompletedTask;
		}

		public Task EditorSelectionChangedNotificationAsync(Uri uri, EditorState editorState,
			List<Range> visibleRanges, int? totalLines, CodemarkType codemarkType, CancellationToken? cancellationToken = null) {
			if (!IsReady) return Task.CompletedTask;

			try {
				_ = BrowserService.NotifyAsync(new HostDidChangeEditorSelectionNotificationType {
					Params = new HostDidChangeEditorSelectionNotification(uri, editorState.ToEditorSelectionsSafe(), visibleRanges, totalLines)
				});
			}
			catch (Exception ex) {
				Log.Error(ex, $"{nameof(EditorSelectionChangedNotificationAsync)} Uri={uri}");
			}

			return Task.CompletedTask;
		}

		public async Task NewCodemarkAsync(Uri uri, Range range, CodemarkType codemarkType, string source, CancellationToken? cancellationToken = null) {
			if (IsReady) {
				try {
					_ = BrowserService.NotifyAsync(new NewCodemarkNotificationType {
						Params = new NewCodemarkNotification(uri, range, codemarkType, source)
					});
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(NewCodemarkAsync)} Uri={uri}");
				}
			}

			await Task.CompletedTask;
		}
	}
}
