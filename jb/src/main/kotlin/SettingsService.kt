package com.codestream

import protocols.agent.Extension
import protocols.agent.Ide
import protocols.agent.TraceLevel
import protocols.webview.CodeStreamEnvironment

data class Settings(
    val email: String?,
    val autoSignIn: Boolean,
    val muteAll: Boolean
)


class SettingsService {

    val autoSignIn: Boolean
        get() = false
    val serverUrl: String
        get() = "https://pd-api.codestream.us:9443"
//        get() = "https://qa-api.codestream.us"
//        get() = "https://api.codestream.com"
    val webAppUrl: String
        get() = "http://pd-app.codestream.us:1380"
//        get() = "http://qa-app.codestream.us"
//        get() = "https://app.codestream.com"
    val email: String?
        get() = null
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
        get() = "0.6.6.6"
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
        return Settings(email, autoSignIn, false)
    }

}
