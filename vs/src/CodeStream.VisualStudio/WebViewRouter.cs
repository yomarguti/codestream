using CodeStream.VisualStudio.Controllers;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using System.Linq;
using System.Threading;
using System.Windows.Threading;

namespace CodeStream.VisualStudio {
	public class WebViewRouter {
		private static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();

		private readonly Lazy<ICredentialsService> _credentialsService;
		private readonly ISessionService _sessionService;
		private readonly ICodeStreamAgentService _codeStreamAgent;
		private readonly ISettingsService _settingsService;
		private readonly IEventAggregator _eventAggregator;
		private readonly IWebviewIpc _ipc;
		private readonly IIdeService _ideService;

		public WebViewRouter(
			Lazy<ICredentialsService> credentialsService,
			ISessionService sessionService,
			ICodeStreamAgentService codeStreamAgent,
			ISettingsService settingsService,
			IEventAggregator eventAggregator,
			IWebviewIpc ipc,
			IIdeService ideService) {
			_credentialsService = credentialsService;
			_sessionService = sessionService;
			_codeStreamAgent = codeStreamAgent;
			_settingsService = settingsService;
			_eventAggregator = eventAggregator;
			_ipc = ipc;
			_ideService = ideService;
		}

		//
		//
		//TODO use DI in the ctor rather than inline Package/ServiceLocator pattern?
		//
		//

		public async System.Threading.Tasks.Task HandleAsync(WindowEventArgs e) {
			try {
				//guard against possibly non JSON-like data
				if (e?.Message == null || !e.Message.StartsWith("{")) {
					Log.Debug($"{nameof(HandleAsync)} not found => {e?.Message}");
					await System.Threading.Tasks.Task.CompletedTask;
				}

				var message = WebviewIpcMessage.Parse(e.Message);

				using (IpcLogger.CriticalOperation(Log, "REC", message)) {
					var target = message.Target();
					switch (target) {
						case IpcRoutes.Agent: {
								using (var scope = _ipc.CreateScope(message)) {
									JToken @params = null;
									string error = null;
									try {
										@params = await _codeStreamAgent.SendAsync<JToken>(message.Method, message.Params);
									}
									catch (Exception ex) {
										Log.Warning(ex, $"Method={message.Method}");
										error = ex.Message;
									}
									finally {
										scope.FulfillRequest(@params, error);
									}
								}
								break;
							}
						case IpcRoutes.Host: {
								switch (message.Method) {
									case WebviewDidInitializeNotificationType.MethodName: {
											// ready -- nothing to do!
											break;
										}
									case WebviewDidChangeContextNotificationType.MethodName: {
											var @params = message.Params.ToObject<WebviewDidChangeContextNotification>();
											if (@params != null) {
												var panelStack = @params.Context?.PanelStack;
												_sessionService.PanelStack = panelStack;
												if (panelStack != null) {
													var visible = panelStack.FirstOrDefault() == WebviewPanels.CodemarksForFile;
													_sessionService.IsCodemarksForFileVisible = visible;
													_sessionService.AreMarkerGlyphsVisible = !visible;

													_eventAggregator.Publish(new MarkerGlyphVisibilityEvent { IsVisible = !visible });
												}

												await ServiceLocator.Get<SUserSettingsService, IUserSettingsService>()?.SaveContextAsync(@params.Context);
											}
											break;
										}
									case CompareMarkerRequestType.MethodName:
									case ApplyMarkerRequestType.MethodName: {
											break;
										}
									case GetViewBootstrapDataRequestType.MethodName:
									case LoginRequestType.MethodName:
									case SignupRequestType.MethodName:
									case SlackLoginRequestType.MethodName:
									case CompleteSignupRequestType.MethodName: {
											await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);

											var authenticationController = new AuthenticationController(
												_settingsService,
												_sessionService,
												_codeStreamAgent,
												_eventAggregator,
												_ipc,
												_ideService,
												_credentialsService);

											switch (message.Method) {
												case GetViewBootstrapDataRequestType.MethodName:
													await authenticationController.BootstrapAsync(message);
													break;
												case LoginRequestType.MethodName:
													await authenticationController.AuthenticateAsync(message,
														message.Params["email"].ToString(),
														message.Params["password"].ToString());
													break;
												case SignupRequestType.MethodName:
													await authenticationController.GoToSignupAsync(message);
													break;
												case SlackLoginRequestType.MethodName:
													await authenticationController.GoToSlackSigninAsync(message);
													break;
												case CompleteSignupRequestType.MethodName:
													await authenticationController.ValidateSignupAsync(message, message?.Params.ToObject<CompleteSignupRequest>());
													break;
												default:
													Log.Warning($"Shouldn't hit this Method={message.Method}");
													break;
											}
											break;
										}
									case SignOutRequestType.MethodName: {
											await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
											using (_ipc.CreateScope(message)) {
												var codeStreamService = Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;
												if (codeStreamService != null) {
													await codeStreamService.LogoutAsync();
												}
											}
											break;
										}
									case EditorSelectRangeRequestType.MethodName: {
											using (var scope = _ipc.CreateScope(message)) {
												bool result = false;
												var activeTextView = _ideService.GetActiveTextView();
												if (activeTextView != null) {
													await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
													var @params = message.Params.ToObject<EditorSelectRangeRequest>();
													if (@params != null) {
														result = activeTextView.SelectRange(@params.Selection, @params.PreserveFocus == false);
													}
													if (!result) {
														Log.Verbose($"{nameof(EditorSelectRangeRequestType)} result is false");
													}
												}
												scope.FulfillRequest(new EditorSelectRangeResponse { Success = result }.ToJToken());
												break;
											}
										}
									case EditorHighlightRangeRequestType.MethodName: {
											using (var scope = _ipc.CreateScope(message)) {
												var activeTextView = _ideService.GetActiveTextView();
												bool result = false;
												if (activeTextView != null) {
													await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
													var @params = message.Params.ToObject<EditorHighlightRangeRequest>();
													if (@params != null) {
														//don't reveal on highlight -- for big ranges it will cause bad behavior with the scrolling
														result = activeTextView.Highlight(@params.Range, @params.Highlight);
														if (!result) {
															Log.Verbose($"{nameof(EditorHighlightRangeRequestType)} result is false");
														}
													}
												}
												scope.FulfillRequest(new EditorHighlightRangeResponse { Success = result }.ToJToken());
												break;
											}
										}
									case EditorRevealRangeRequestType.MethodName: {
											using (var scope = _ipc.CreateScope(message)) {
												await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
												var @params = message.Params.ToObject<EditorRevealRangeRequest>();
												var result = await _ideService.OpenEditorAndRevealAsync(@params.Uri.ToUri(), @params.Range?.Start?.Line, atTop: @params.AtTop, focus: @params.PreserveFocus == false);
												if (!result) {
													Log.Verbose($"{nameof(EditorRevealRangeRequestType)} result is false");
												}
												scope.FulfillRequest(new EditorRevealRangeResponse { Success = result }.ToJToken());
											}
											break;
										}
									case EditorScrollToNotificationType.MethodName: {
											var @params = message.Params.ToObject<EditorScrollToNotification>();
											_ideService.ScrollEditorThrottled(@params.Uri.ToUri(), @params.Range, @params.Position, @params.AtTop);
											
											// this alternate version, using the dispatcher here instead of inside the throttle works

											//System.Windows.Application.Current.Dispatcher.Invoke(() => {
											//	try {
											//_ideService.ScrollEditor(@params.Uri.ToUri(), @params.Position.Line, @params.AtTop);											 
											//	}
											//	catch (Exception ex) {
											//		Log.Warning(ex, nameof(EditorRevealRangeRequestType));
											//	}
											//}, DispatcherPriority.Input);
											break;
										}
									case ReloadWebviewRequestType.MethodName: {
											using (_ipc.CreateScope(message)) {
												_ipc.BrowserService.ReloadWebView();
											}
											break;
										}
									case UpdateConfigurationRequestType.MethodName: {
											await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

											using (_ipc.CreateScope(message)) {
												// NOTE: we're not using the controller here. changing these properties
												// triggers the OnPropertyChanged, which then uses the ConfigurationController
												// for added handling

												// Webview no longer sends these updates -- keeping for reference
#if DEBUG
												Log.Warning(message.ToJson());
#endif
												//using (var scope = SettingsScope.Create(_settingsService))
												//{
												//    var @params = message.Params.ToObject<UpdateConfigurationRequest>();
												//    if (@params.Name == "showMarkerGlyphs")
												//    {
												//        scope.SettingsService.ShowMarkerGlyphs = @params.Value.AsBool();
												//    }													
												//}
											}
											break;
										}
									case LiveShareStartSessionRequestType.MethodName:
									case LiveShareInviteToSessionRequestType.MethodName:
									case LiveShareJoinSessionRequestType.MethodName: {
											var liveShareController = new LiveShareController(
												_sessionService,
												_codeStreamAgent,
												_eventAggregator,
												_ipc,
												_ideService);

											using (_ipc.CreateScope(message)) {
												switch (message.Method) {
													case LiveShareStartSessionRequestType.MethodName: {
															var @params = message.Params.ToObject<LiveShareStartSessionRequest>();
															await liveShareController.StartAsync(@params.StreamId, @params.ThreadId);
															break;
														}
													case LiveShareInviteToSessionRequestType.MethodName: {
															await liveShareController.InviteAsync(message.Params.ToObject<LiveShareInviteToSessionRequest>()?.UserId);
															break;
														}
													case LiveShareJoinSessionRequestType.MethodName: {
															await liveShareController.JoinAsync(message.Params.ToObject<LiveShareJoinSessionRequest>()?.Url);
															break;
														}
													default: {
															Log.Warning($"Unknown LiveShare method {message.Method}");
															break;
														}
												}
											}
											break;
										}
									default: {
											Log.Warning($"Unhandled Target={target} Method={message.Method}");
											break;
										}
								}
								break;
							}
						default: {
								Log.Warning($"Unknown Target={target}");
								break;
							}
					}
				}
			}
			catch (Exception ex) {
				Log.Error(ex, "Message={Message}", e?.Message);
			}

			await System.Threading.Tasks.Task.CompletedTask;
		}
	}
}
