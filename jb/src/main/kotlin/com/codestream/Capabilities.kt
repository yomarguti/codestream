package com.codestream

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Capabilities(
    val codemarkApply: Boolean,
    val codemarkCompare: Boolean,
    val editorTrackVisibleRange: Boolean,
    val services: Services
)

@JsonClass(generateAdapter = true)
data class Services(val vsls: Boolean = false)
