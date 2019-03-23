package com.codestream

import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.extensions.PluginId
import protocols.agent.Extension
import protocols.agent.Ide
import protocols.agent.TraceLevel
import protocols.webview.CodeStreamEnvironment

data class Settings(
    val email: String?,
    val autoSignIn: Boolean,
    val muteAll: Boolean
)

data class SettingsServiceState(
    var autoSignIn: Boolean = true,
    var email: String? = null,
//    var serverUrl: String = "https://pd-api.codestream.us:9443",
//        var serverUrl: String = "https://qa-api.codestream.us"
        var serverUrl: String = "https://api.codestream.com",
//    var webAppUrl: String = "http://pd-app.codestream.us:1380",
//        var webAppUrl: String = "http://qa-app.codestream.us",
        var webAppUrl: String = "https://app.codestream.com",
    var webViewConfig: MutableMap<String, String?> = mutableMapOf(
//        "serverUrl" to serverUrl,
//        "email" to null,
//        "openCommentOnSelect" to true,
//        "showHeadshots" to true,
//        "showMarkers" to true,
//        "viewCodemarksInline" to true,
//        "muteAll" to false,
//        "team" to null,
//        "debug" to true
    )
)

@State(name = "CodeStream", storages = [Storage("codestream.xml")])
class SettingsService : PersistentStateComponent<SettingsServiceState> {
    private var _state = SettingsServiceState()

    override fun getState(): SettingsServiceState = _state

    override fun loadState(state: SettingsServiceState) {
        _state = state
    }

    val muteAll = false
    val openCommentOnSelect = true
    val showHeadshots = true
    val showMarkers = true
    val viewCodemarksInline = true
    val team: String?
        get() = null
    val environment: CodeStreamEnvironment
        get() = CodeStreamEnvironment.PROD
    val environmentVersion: String
        get() = PluginManager.getPlugin(PluginId.findId("com.codestream.jetbrains-codestream"))!!.version
    val extensionInfo: Extension
        get() {
            return Extension()
        }
    val ideInfo: Ide
        get() {
            return Ide()
        }
    val traceLevel: TraceLevel
        get() {
            return TraceLevel.DEBUG
        }
    val isDebugging: Boolean
        get() {
            return true
        }
    val debug = true
    var currentStreamId: String? = null
    var threadId: String? = null

    fun getSettings(): Settings {
        return Settings(state.email, state!!.autoSignIn, false)
    }

}
