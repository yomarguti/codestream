package com.codestream

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Configs(
    val serverUrl: String,
    val email: String?,
    val openCommentOnSelect: Boolean,
    val showHeadshots: Boolean,
    val showMarkers: Boolean,
    val muteAll: Boolean,
    val team: String?
)
