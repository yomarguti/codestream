package com.codestream.settings

import com.codestream.DEBUG
import com.codestream.gson
import com.codestream.sessionService
import com.github.salomonbrys.kotson.fromJson
import com.github.salomonbrys.kotson.set
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.util.net.HttpConfigurable
import protocols.agent.Extension
import protocols.agent.Ide
import protocols.agent.ProxySettings
import protocols.agent.TraceLevel
import protocols.webview.CodeStreamEnvironment
import protocols.webview.Configs
import protocols.webview.WebViewContext
import kotlin.properties.Delegates

const val INLINE_CODEMARKS = "viewCodemarksInline"

private const val API_PD = "https://pd-api.codestream.us:9443"
private const val API_QA = "https://qa-api.codestream.us"
private const val API_PROD = "https://api.codestream.com"

data class SettingsServiceState(
    var autoSignIn: Boolean = true,
    var email: String? = null,
    var serverUrl: String = API_PROD,
    var avatars: Boolean = true,
    var notifications: String? = null,
    var muteAll: Boolean = false,
    var team: String? = null,
    var showFeedbackSmiley: Boolean = true,
    var showMarkers: Boolean = true,
    var autoHideMarkers: Boolean = true,
    var proxySupport: String = "on",
    var proxyUrl: String = "",
    var proxyStrictSSL: Boolean = true,
    var webViewConfig: MutableMap<String, String?> = mutableMapOf(
        INLINE_CODEMARKS to "true"
    ),
    var webViewContext: String = "{}"
)

@State(name = "CodeStream", storages = [Storage("codestream.xml")])
class SettingsService(val project: Project) : PersistentStateComponent<SettingsServiceState> {
    private var _state = SettingsServiceState()

    override fun getState(): SettingsServiceState = _state

    override fun loadState(state: SettingsServiceState) {
        _state = state
    }

    private val viewCodemarksInline get() = state.webViewConfig[INLINE_CODEMARKS]?.toBoolean() ?: true
    val environment get() = CodeStreamEnvironment.PROD
    val environmentVersion: String
        get() = PluginManager.getPlugin(
            PluginId.findId("com.codestream.jetbrains-codestream")
        )!!.version
    val extensionInfo get() = Extension(environmentVersion)
    val ideInfo get() = Ide()
    val traceLevel get() = TraceLevel.VERBOSE
    val isDebugging get() = DEBUG
    val currentStreamId get() = webViewContext?.currentStreamId
    val threadId get() = webViewContext?.threadId
    val team get() = state.team
    val autoHideMarkers get() = state.autoHideMarkers
    val showMarkers get() = state.showMarkers
    val proxySupport get() = state.proxySupport
    val notifications: String?
        get() {
            if (state.notifications == null) {
                return if (project.sessionService?.isSlackTeam == true) "none" else "mentions"
            }
            return state.notifications
        }

    var webViewContext by Delegates.observable<WebViewContext?>(null) { _, _, new ->
        _webViewContextObservers.forEach { it(new) }
    }

    val webViewConfigs
        get() = Configs(
            state.serverUrl,
            state.email,
            state.avatars,
            viewCodemarksInline,
            state.muteAll,
            isDebugging,
            state.showFeedbackSmiley
        )

    val environmentDisplayPrefix
        get() = when (state.serverUrl) {
            API_PD -> "PD:"
            API_QA -> "QA:"
            else -> if (state.serverUrl.contains("localhost")) {
                "Local:"
            } else {
                "CodeStream:"
            }
        }

    // 💩: I HATE THIS
    fun set(name: String, value: String?) {
        if (state.webViewConfig.containsKey(name)) {
            state.webViewConfig[name] = value
        } else {
            when (name) {
                "muteAll" -> value?.let {
                    state.muteAll = it.toBoolean()
                }
            }
        }
    }

    val proxySettings
        get(): ProxySettings? {
            return when (state.proxySupport) {
                "on" -> {
                    val host = HttpConfigurable.getInstance().PROXY_HOST ?: return null
                    val port = HttpConfigurable.getInstance().PROXY_PORT
                    ProxySettings("$host:$port", state.proxyStrictSSL)
                }
                "override" -> ProxySettings(state.proxyUrl, state.proxyStrictSSL)
                else -> null
            }
        }

    val credentialAttributes: CredentialAttributes
        get() = CredentialAttributes(
            generateServiceName("CodeStream", state.serverUrl),
            state.email
        )

    fun getWebViewContextJson(): JsonElement {
        var jsonObject = gson.fromJson<JsonObject>(state.webViewContext)
        project.sessionService?.userLoggedIn?.team?.id.let {
            jsonObject["currentTeamId"] = it
        }
        jsonObject["hasFocus"] = true
        return jsonObject
    }

    fun setWebViewContextJson(json: JsonElement) {
        state.webViewContext = json.toString()
        webViewContext = gson.fromJson(json)
    }

    private val _webViewContextObservers = mutableListOf<(WebViewContext?) -> Unit>()
    fun onWebViewContextChanged(observer: (WebViewContext?) -> Unit) {
        _webViewContextObservers += observer
    }
}
