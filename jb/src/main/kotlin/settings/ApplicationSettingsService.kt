package com.codestream.settings

import com.codestream.DEBUG
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.extensions.PluginId
import com.intellij.util.net.HttpConfigurable
import protocols.agent.Extension
import protocols.agent.Ide
import protocols.agent.ProxySettings
import protocols.agent.TraceLevel
import protocols.webview.Configs

private const val API_PD = "https://pd-api.codestream.us:9443"
private const val API_QA = "https://qa-api.codestream.us"
private const val API_PROD = "https://api.codestream.com"

data class ApplicationSettingsServiceState(
    var autoSignIn: Boolean = true,
    var email: String? = null,
    var serverUrl: String = API_PROD,
    var avatars: Boolean = true,
    var notifications: String? = null,
    var team: String? = null,
    var showFeedbackSmiley: Boolean = true,
    var showMarkers: Boolean = true,
    var autoHideMarkers: Boolean = true,
    var proxySupport: String = "on",
    var proxyUrl: String = "",
    var proxyStrictSSL: Boolean = true
)

@State(name = "CodeStream", storages = [Storage("codestream.xml")])
class ApplicationSettingsService : PersistentStateComponent<ApplicationSettingsServiceState> {
    private var _state = ApplicationSettingsServiceState()
    private val logger = Logger.getInstance(ApplicationSettingsService::class.java)

    override fun getState(): ApplicationSettingsServiceState = _state

    override fun loadState(state: ApplicationSettingsServiceState) {
        state.serverUrl = if (state.serverUrl.isNullOrEmpty()) state.serverUrl else state.serverUrl.trimEnd('/')
        _state = state
    }

    val environmentVersion: String
        get() = PluginManager.getPlugin(
            PluginId.findId("com.codestream.jetbrains-codestream")
        )!!.version
    val extensionInfo get() = Extension(environmentVersion)
    val ideInfo get() = Ide()
    val traceLevel get() = if (logger.isDebugEnabled) TraceLevel.DEBUG else TraceLevel.VERBOSE
    val isDebugging get() = DEBUG
    val team get() = state.team
    val autoHideMarkers get() = state.autoHideMarkers
    val showMarkers get() = state.showMarkers
    val notifications get() = state.notifications
    val serverUrl get() = state.serverUrl
    val email get() = state.email
    val avatars get() = state.avatars
    val showFeedbackSmiley get() = state.showFeedbackSmiley
    val autoSignIn get() = state.autoSignIn

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

    val environmentName
        get() = when (state.serverUrl) {
            API_PD -> "pd"
            API_QA -> "qa"
            else -> if (state.serverUrl.contains("localhost")) {
                "local"
            } else {
                "prod"
            }
        }

    val proxySettings
        get(): ProxySettings? {
            var url: String? = null
            if (!state.proxyUrl.isNullOrBlank()) {
                url = state.proxyUrl
            } else {
                val httpConfig = HttpConfigurable.getInstance()
                if (httpConfig.USE_HTTP_PROXY && !httpConfig.PROXY_HOST.isNullOrBlank()) {
                    url = httpConfig.PROXY_HOST
                    if (httpConfig.PROXY_PORT != null) {
                        url = url + ":" + httpConfig.PROXY_PORT
                    }
                }
            }

            return if (url != null) {
                ProxySettings(url, state.proxyStrictSSL)
            } else {
                null
            }
        }

    val proxySupport
        get(): String? =
            if (state.proxySupport == "on" && proxySettings != null)
                "override"
            else
                state.proxySupport

    val credentialAttributes: CredentialAttributes
        get() {
            // https://youtrack.jetbrains.com/issue/IDEA-223257?p=WI-48781
            val constructor = CredentialAttributes::class.constructors.first()
            val serviceName = generateServiceName("CodeStream", state.serverUrl)
            val userName = state.email
            return if (constructor.parameters.size == 4) {
                constructor.call(serviceName, userName, null, false)
            } else {
                constructor.call(serviceName, userName, null, false, true)
            }
        }

    val webViewConfigs
        get() = Configs(
            state.serverUrl,
            state.email,
            state.avatars,
            isDebugging,
            state.showFeedbackSmiley,
            state.team
        )
}
