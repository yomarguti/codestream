using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI;
using Microsoft;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Services {
	public interface SCodeStreamService { }

	public interface ICodeStreamService {
		Task ResetActiveEditorAsync();
		Task ChangeActiveEditorAsync(string fileName, Uri uri, ActiveTextEditor activeTextEditor = null);
		Task NewCodemarkAsync(Uri uri, Range range, CodemarkType codemarkType, string source, CancellationToken? cancellationToken = null);
		Task ShowCodemarkAsync(string codemarkId, CancellationToken? cancellationToken = null);
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
		IWebviewIpc WebviewIpc { get; }
		Task TrackAsync(string eventName, TelemetryProperties properties = null);
		bool IsReady { get; }
		ISessionService SessionService { get; }
		ICodeStreamAgentService AgentService { get; }
	}

	[Injected]
	public class CodeStreamService : ICodeStreamService, SCodeStreamService {
		private static readonly ILogger Log = LogManager.ForContext<CodeStreamService>();
		private readonly IAsyncServiceProvider _asyncServiceProvider;
		public ISessionService SessionService { get; }
		public ICodeStreamAgentService AgentService { get; }
		public IWebviewIpc WebviewIpc { get; }

		public CodeStreamService(
			IAsyncServiceProvider serviceProvider,
			ICodeStreamAgentService agentService,
			IWebviewIpc ipc) {
			_asyncServiceProvider = serviceProvider;
			AgentService = agentService;
			SessionService = agentService.SessionService;
			WebviewIpc = ipc;
		}
		
		public bool IsReady => SessionService?.IsReady == true;

		public async Task ChangeActiveEditorAsync(string fileName, Uri uri, ActiveTextEditor activeTextEditor = null) {
			if (IsReady) {
				try {
					var componentModel = await _asyncServiceProvider.GetServiceAsync(typeof(SComponentModel)) as IComponentModel;
					Assumes.Present(componentModel);
					var editorService = componentModel.GetService<IEditorService>();
					activeTextEditor = activeTextEditor ?? editorService.GetActiveTextEditor(uri);
					var editorState = editorService.GetActiveEditorState();

					_ = WebviewIpc.NotifyAsync(new HostDidChangeActiveEditorNotificationType {
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
					Log.Error(ex, $"{nameof(ChangeActiveEditorAsync)} FileName={fileName} Uri={uri}");
				}
			}

			await Task.CompletedTask;
		}

		public Task ResetActiveEditorAsync() {
			if (!IsReady) return Task.CompletedTask;

			try {
				_ = WebviewIpc.NotifyAsync(new HostDidChangeActiveEditorNotificationType {
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
				_ = WebviewIpc.NotifyAsync(new ShowStreamNotificationType {
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

		public async Task ShowCodemarkAsync(string codemarkId, CancellationToken? cancellationToken = null) {
			if (IsReady && !codemarkId.IsNullOrWhiteSpace()) {
				_ = WebviewIpc.NotifyAsync(new ShowCodemarkNotificationType {
					Params = new ShowCodemarkNotification {
						CodemarkId = codemarkId
					}
				});
			}
			await Task.CompletedTask;
		}

		public Task EditorSelectionChangedNotificationAsync(Uri uri, EditorState editorState,
			List<Range> visibleRanges, int? totalLines, CodemarkType codemarkType, CancellationToken? cancellationToken = null) {
			if (!IsReady) return Task.CompletedTask;

			try {
				_ = WebviewIpc.NotifyAsync(new HostDidChangeEditorSelectionNotificationType {
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
					_ = WebviewIpc.NotifyAsync(new NewCodemarkNotificationType {
						Params = new NewCodemarkNotification(uri, range, codemarkType, source)
					});
				}
				catch (Exception ex) {
					Log.Error(ex, $"{nameof(NewCodemarkAsync)} Uri={uri}");
				}
			}

			await Task.CompletedTask;
		}

		public async Task TrackAsync(string eventName, TelemetryProperties properties = null) {
			if (IsReady) {
				_ = AgentService.TrackAsync(eventName, properties);
			}

			await Task.CompletedTask;
		}
	}
}
