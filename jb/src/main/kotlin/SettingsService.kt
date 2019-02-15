package com.codestream

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
//        get() = "https://api.codestream.com"
    val email: String?
        get() = null
    val openCommentOnSelect: Boolean
        get() = false
    val showHeadshots: Boolean
        get() = false
    val showMarkers: Boolean
        get() = false
    val team: String?
        get() = null
    val environmentName: String
        get() = "Production"
    val environmentVersion: String
        get() = "0.6.6.6"

    fun getSettings(): Settings {
        return Settings(email, autoSignIn, false)
    }

}