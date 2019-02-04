package com.codestream

import AuthenticationService
import com.intellij.openapi.diagnostic.Logger
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.teamdev.jxbrowser.chromium.events.ConsoleEvent
import com.teamdev.jxbrowser.chromium.events.ConsoleListener

val moshi: Moshi = Moshi.Builder()
    .add(KotlinJsonAdapterFactory())
//    .add(Date::class.java, Rfc3339DateJsonAdapter().nullSafe())
    .build()
val webViewMessageAdapter: JsonAdapter<WebViewMessage> = moshi.adapter(WebViewMessage::class.java)


class WebViewRouter : ConsoleListener {
    val logger = Logger.getInstance(WebViewRouter::class.java)

//    private readonly Lazy<ICredentialsService> _credentialsService;
//    private readonly ISessionService _sessionService;
//    private readonly ICodeStreamAgentService _codeStreamAgent;
//    private readonly ISettingsService _settingsService;
//    private readonly IEventAggregator _eventAggregator;
//    private readonly IBrowserService _browserService;
//    private readonly IIdeService _ideService;

    private val auth: AuthenticationService
        get() = AuthenticationService()

    override fun onMessage(e: ConsoleEvent?) {
        if (e?.message == null || !e.message.startsWith("{")) {
            return
        }

        val (type, body) = parse(e.message) ?: return
        when (type) {
            "request" -> processRequest(body)
        }
    }

    private fun processRequest(body: WebViewMessageBody) {
        when (body.action) {
            "bootstrap" -> auth.bootstrap(body.id)
            "authenticate" -> auth.authenticate(body.id) //, body.Params["email"].ToString(), body.Params["password"].ToString());
            "go-to-signup" -> auth.goToSignup(body.id)
            "go-to-slack-signin" -> auth.goToSlackSignin(body.id)
            "validate-signup" -> auth.validateSignup(body.id) //, body.Params?.Value<string>())
            "show-markers",
            "open-comment-on-select" -> {
//                        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
//                        var value = message.Params.ToObject<bool>();
//
//                        switch (message.Action)
//                        {
//                            case "show-markers":
//                            using (var scope = SettingsScope.Create(_settingsService))
//                            {
//                                scope.SettingsService.ShowMarkers = value;
//                            }
//
//                            break;
//                            case "open-comment-on-select":
//                            using (var scope = SettingsScope.Create(_settingsService))
//                            {
//                                scope.SettingsService.OpenCommentOnSelect = value;
//                            }
//
//                            break;
//                            default:
//                            Log.Warning($"Shouldn't hit this Action={message.Action}");
//                            break;
//                        }
            }
            "mute-all" -> Unit
            "show-code" -> {
//                        var showCodeResponse = message.Params.ToObject<ShowCodeResponse>();
//
//                        var fromMarkerResponse = await _codeStreamAgent.GetDocumentFromMarkerAsync(
//                                new DocumentFromMarkerRequest()
//                                {
//                                    File = showCodeResponse.Marker.File,
//                                    RepoId = showCodeResponse.Marker.RepoId,
//                                    MarkerId = showCodeResponse.Marker.Id,
//                                    Source = showCodeResponse.Source
//                                });
//
//                        if (fromMarkerResponse?.TextDocument?.Uri != null)
//                        {
//                            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
//                            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
//                            if (ideService != null)
//                            {
//                                var editorResponse = ideService.OpenEditor(
//                                    fromMarkerResponse.TextDocument.Uri.ToUri(),
//                                    fromMarkerResponse.Range?.Start?.Line + 1);
//
//                                _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, editorResponse.ToString()));
//                            }
//                        }
            }
            else -> {
//                        string payloadResponse = null;
//                        string errorResponse = null;
//
//                        try
//                        {
//                            var response = await _codeStreamAgent.SendAsync<JToken>(message.Action, message.Params);
//                            payloadResponse = response.ToString();
//                        }
//                        catch (Exception ex)
//                        {
//                            errorResponse = ex.ToString();
//                        }
//                        _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, payloadResponse, errorResponse));
//                        break;
            }

        }


    }

    private fun parse(json: String): WebViewMessage? = webViewMessageAdapter.fromJson(json)

}