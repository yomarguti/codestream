package com.codestream.webview

import com.codestream.*
import com.github.salomonbrys.kotson.*
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.BrowserUtil
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import protocols.agent.*
import protocols.webview.*
import kotlin.properties.Delegates

typealias ReadyObserver = () -> Unit

class WebViewRouter(val project: Project) {
    private val logger = Logger.getInstance(WebViewRouter::class.java)
    private val readyObservers = mutableListOf<ReadyObserver>()
    private var _isReady: Boolean by Delegates.observable(false) { _, _, isReady -> readyObservers.forEach { if (isReady) it() } }
    val isReady get() = _isReady

    fun onWebviewReady(observer: ReadyObserver) {
        readyObservers.add(observer)
    }

    fun reload() {
        _isReady = false
    }

    fun handle(rawMessage: String, origin: String?) = GlobalScope.launch {
        val message = parse(rawMessage)

        try {
            when (message.target) {
                "host" -> processHostMessage(message)
                "codestream" -> processAgentMessage(message)
                else -> throw IllegalArgumentException("Invalid webview message target: ${message.target}")
            }
        } catch (e: Exception) {
            logger.warn(e)
            if (message.id != null) {
                project.webViewService?.postResponse(message.id, null, e.message)
            }
        }
    }

    private suspend fun processAgentMessage(message: WebViewMessage) {
        val agentService = project.agentService ?: return
        val webViewService = project.webViewService ?: return
        val response = agentService.remoteEndpoint.request(message.method, message.params).await()
        if (message.id != null) {
            webViewService.postResponse(message.id, response)
        }
    }

    private suspend fun processHostMessage(message: WebViewMessage) {
        var resumeReady = false
        val response = when (message.method) {
            "host/bootstrap" -> bootstrap()
            "host/login" -> {
                _isReady = false
                resumeReady = true
                login(message)
            }
            "host/didInitialize" -> _isReady = true
            "host/logout" -> logout()
            "host/slack/login" -> slackLogin(message)
            "host/signup" -> signup(message)
            "host/signup/complete" -> signupComplete(message)
            "host/context/didChange" -> contextDidChange(message)
            "host/webview/reload" -> project.webViewService?.reload()
            // "host/marker/compare" -> Unit
            // "host/marker/apply" -> Unit
            "host/configuration/update" -> configurationUpdate(message)
            "host/editor/range/highlight" -> editorRangeHighlight(message)
            "host/editor/range/reveal" -> editorRangeReveal(message)
            "host/editor/range/select" -> editorRangeSelect(message)
            "host/editor/scrollTo" -> editorScrollTo(message)
            else -> logger.warn("Unhandled host message ${message.method}")
        }
        if (message.id != null) {
            project.webViewService?.postResponse(message.id, response)
            if (resumeReady) _isReady = true
        }
    }

    private suspend fun bootstrap(): Any {
        val settingsService = project.settingsService ?: return Unit
        val agentService = project.agentService ?: return Unit
        val sessionService = project.sessionService ?: return Unit
        val editorService = project.editorService ?: return Unit

        if (settingsService.state.autoSignIn) {
            val attr = CredentialAttributes(
                generateServiceName("CodeStream", settingsService.state.serverUrl),
                settingsService.state.email
            )
            val token = PasswordSafe.instance.getPassword(attr)

            if (token != null) {
                val loginResult = agentService.agent.login(
                    LoginWithTokenParams(
                        settingsService.state.email,
                        AccessToken(
                            settingsService.state.email,
                            settingsService.state.serverUrl,
                            token
                        ),
                        settingsService.state.serverUrl,
                        settingsService.extensionInfo,
                        settingsService.ideInfo,
                        settingsService.traceLevel.value,
                        settingsService.isDebugging,
                        settingsService.team,
                        settingsService.proxySupport,
                        settingsService.proxySettings
                    )
                ).await()

                loginResult.result.error?.let {
                    project.notificationComponent?.showError("Login error", it)
                    return SignedOutBootstrapResponse(
                        Capabilities(false, false, false, false, Services(false)),
                        mapOf("email" to settingsService.state.email),
                        settingsService.environment,
                        settingsService.environmentVersion
                    )
                }

                val bootstrapFuture = agentService.agent.bootstrap(BootstrapParams())
                sessionService.login(loginResult.result.userLoggedIn)

                val webViewResponse = SignedInBootstrapResponse(
                    Capabilities(
                        true,
                        false,
                        false,
                        true,
                        Services(false)
                    ),
                    settingsService.getWebviewConfigs(),
                    settingsService.environment,
                    settingsService.environmentVersion,
                    settingsService.webViewContext,
                    editorService.getEditorContext(),
                    UserSession(
                        sessionService.userLoggedIn!!.state.userId
                    )
                )

                val webViewResponseJson = gson.toJsonTree(webViewResponse)
                val bootstrapResponse = bootstrapFuture.await()

                for ((key, value) in bootstrapResponse.obj.entrySet()) {
                    webViewResponseJson[key] = value
                }

                return webViewResponseJson
            }
        }

        if (!sessionService.isSignedIn) {
            return SignedOutBootstrapResponse(
                Capabilities(false, false, false, false, Services(false)),
                mapOf("email" to settingsService.state.email),
                settingsService.environment,
                settingsService.environmentVersion
            )
        }
        TODO("not implemented")
    }

    private suspend fun login(message: WebViewMessage): JsonElement {
        val settingsService = project.settingsService ?: return jsonObject()
        val agentService = project.agentService ?: return jsonObject()
        val sessionService = project.sessionService ?: return jsonObject()
        val editorService = project.editorService ?: return jsonObject()

        val params = gson.fromJson<LoginRequest>(message.params!!)
        val loginResult = agentService.agent.login(
            LoginWithPasswordParams(
                params.email,
                params.password,
                settingsService.state.serverUrl,
                settingsService.extensionInfo,
                settingsService.ideInfo,
                settingsService.traceLevel.value,
                settingsService.isDebugging,
                settingsService.team,
                settingsService.proxySupport,
                settingsService.proxySettings
            )
        ).await()

        loginResult.result.error?.let {
            throw Exception(it)
        }

        val bootstrapFuture = agentService.agent.bootstrap(BootstrapParams())
        sessionService.login(loginResult.result.userLoggedIn)
        settingsService.state.email = params.email

        PasswordSafe.instance.set(
            CredentialAttributes(
                generateServiceName("CodeStream", settingsService.state.serverUrl),
                settingsService.state.email
            ),
            Credentials(null, loginResult.result.loginResponse!!.accessToken)
        )

        val webViewResponse = SignedInBootstrapResponse(
            Capabilities(
                false,
                false,
                false,
                true,
                Services(false)
            ),
            settingsService.getWebviewConfigs(),
            settingsService.environment,
            settingsService.environmentVersion,
            settingsService.webViewContext,
            editorService.getEditorContext(),
            UserSession(
                sessionService.userLoggedIn!!.state.userId
            )
        )

        val webViewResponseJson = gson.toJsonTree(webViewResponse)
        val bootstrapResponse = bootstrapFuture.await()

        for ((key, value) in bootstrapResponse.obj.entrySet()) {
            webViewResponseJson[key] = value
        }

        return webViewResponseJson
    }

    private fun slackLogin(message: WebViewMessage) {
        val sessionService = project.sessionService ?: return
        val settingsService = project.settingsService ?: return
        BrowserUtil.browse("${settingsService.state.webAppUrl}/service-auth/slack?state=${sessionService.signupToken}")
    }

    private fun signup(message: WebViewMessage) {
        val sessionService = project.sessionService ?: return
        val settingsService = project.settingsService ?: return
        BrowserUtil.browse("${settingsService.state.webAppUrl}/signup?force_auth=true&signup_token=${sessionService.signupToken}")
    }

    private fun logout() {
        val agentService = project.agentService ?: return
        val sessionService = project.sessionService ?: return
        val settingsService = project.settingsService ?: return
        val webViewService = project.webViewService ?: return

        sessionService.logout()
        agentService.agent.logout(LogoutParams())
        PasswordSafe.instance.set(
            CredentialAttributes(
                generateServiceName("CodeStream", settingsService.state.serverUrl),
                settingsService.state.email
            ),
            null
        )
        settingsService.webViewContext = jsonObject()
        webViewService.reload()
    }

    private suspend fun signupComplete(message: WebViewMessage): JsonElement {
        val agentService = project.agentService ?: return jsonObject()
        val editorService = project.editorService ?: return jsonObject()
        val sessionService = project.sessionService ?: return jsonObject()
        val settingsService = project.settingsService ?: return jsonObject()

        val token = sessionService.signupToken
        val loginResult = agentService.agent.login(
            LoginWithSignupTokenParams(
                token,
                settingsService.state.serverUrl,
                settingsService.extensionInfo,
                settingsService.ideInfo,
                settingsService.traceLevel.value,
                settingsService.isDebugging,
                settingsService.team,
                settingsService.proxySupport,
                settingsService.proxySettings
            )
        ).await()

        loginResult.result.error?.let {
            throw Exception(it)
        }

        val bootstrapFuture = agentService.agent.bootstrap(BootstrapParams())

        sessionService.login(loginResult.result.userLoggedIn)

        when (loginResult.result.loginResponse) {
            null -> throw Exception("Login result from agent has no error but loginResponse is null")
            else -> settingsService.state.email = loginResult.result.loginResponse.user.email
        }

        PasswordSafe.instance.set(
            CredentialAttributes(
                generateServiceName("CodeStream", settingsService.state.serverUrl),
                settingsService.state.email
            ),
            Credentials(null, loginResult.result.loginResponse!!.accessToken)
        )

        val webViewResponse = SignedInBootstrapResponse(
            Capabilities(
                false,
                false,
                false,
                true,
                Services(false)
            ),
            settingsService.getWebviewConfigs(),
            settingsService.environment,
            settingsService.environmentVersion,
            settingsService.webViewContext,
            editorService.getEditorContext(),
            UserSession(
                sessionService.userLoggedIn!!.state.userId
            )
        )

        val webViewResponseJson = gson.toJsonTree(webViewResponse)
        val bootstrapResponse = bootstrapFuture.await()

        for ((key, value) in bootstrapResponse.obj.entrySet()) {
            webViewResponseJson[key] = value
        }

        return webViewResponseJson
    }

    private fun contextDidChange(message: WebViewMessage) {
        if (message.params == null) return
        val editorService = project.editorService ?: return
        val settingsService = project.settingsService ?: return

        settingsService.webViewContext = message.params["context"].obj

        val notification = gson.fromJson<ContextDidChangeNotification>(message.params)
        notification.context.panelStack?.get(0)?.let {
            if (settingsService.autoHideMarkers && settingsService.showMarkers) {
                if (it == "codemarks-for-file") {
                    editorService.disableMarkers()
                } else {
                    editorService.enableMarkers()
                }
            }
        }
        settingsService.apply {
            currentStreamId = notification.context.currentStreamId
            threadId = notification.context.threadId
        }
    }

    private fun configurationUpdate(message: WebViewMessage): Any {
        val notification = gson.fromJson<UpdateConfigurationRequest>(message.params!!)
        project.settingsService?.set(notification.name, notification.value)
        project.webViewService?.postNotification(
            "webview/config/didChange",
            jsonObject(notification.name to (notification.value == "true"))
        )
        return emptyMap<String, String>()
    }

    fun editorRangeHighlight(message: WebViewMessage) {
        val request = gson.fromJson<EditorRangeHighlightRequest>(message.params!!)

        // Numbers greater than Integer.MAX_VALUE are deserialized as -1. It should not happen,
        // but some versions of the plugin might do that trying to represent a whole line.
        if (request.range.end.character == -1) {
            request.range.end.character = Integer.MAX_VALUE
        }

        project.editorService?.toggleRangeHighlight(request.range, request.highlight)
    }

    suspend fun editorRangeReveal(message: WebViewMessage): EditorRangeRevealResponse {
        val request = gson.fromJson<EditorRangeRevealRequest>(message.params!!)
        val success = project.editorService?.reveal(request.uri, request.range, request.atTop)
            ?: false
        return EditorRangeRevealResponse(success)
    }

    suspend fun editorRangeSelect(message: WebViewMessage): EditorRangeSelectResponse {
        val request = gson.fromJson<EditorRangeSelectRequest>(message.params!!)
        val success = project.editorService?.select(request.uri, request.selection, request.preserveFocus ?: false)
            ?: false
        return EditorRangeSelectResponse(success)
    }

    fun editorScrollTo(message: WebViewMessage) {
        val request = gson.fromJson<EditorScrollToRequest>(message.params!!)
        project.editorService?.scroll(request.uri, request.position, request.atTop)
    }

    private fun parse(json: String): WebViewMessage {
        val parser = JsonParser()
        val jsonObject = parser.parse(json).asJsonObject

        val id = jsonObject.get("id").nullString
        val method = jsonObject.get("method").string
        val params = jsonObject.get("params")
        val error = jsonObject.get("error").nullString

        return WebViewMessage(id, method, params, error)
    }

    class WebViewMessage(
        val id: String?,
        val method: String,
        val params: JsonElement?,
        val error: String?
    ) {
        val target: String = method.split("/")[0]
    }
}

