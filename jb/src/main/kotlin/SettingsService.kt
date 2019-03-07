package com.codestream

import java.util.*

data class Settings(
    val email: String?,
    val autoSignIn: Boolean,
    val muteAll: Boolean
)


class SettingsService {

    val autoSignIn: Boolean
        get() = false
    val serverUrl: String
//        get() = "https://pd-api.codestream.us:9443"
//        get() = "https://qa-api.codestream.us"
        get() = "https://api.codestream.com"
    val webAppUrl: String
//        get() = "http://pd-app.codestream.us:1380"
//        get() = "http://qa-app.codestream.us"
        get() = "https://app.codestream.com"
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