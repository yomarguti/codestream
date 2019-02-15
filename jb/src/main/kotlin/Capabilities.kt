package com.codestream

data class Capabilities(
    val codemarkApply: Boolean,
    val codemarkCompare: Boolean,
    val editorTrackVisibleRange: Boolean,
    val services: Services
)

data class Services(val vsls: Boolean = false)
