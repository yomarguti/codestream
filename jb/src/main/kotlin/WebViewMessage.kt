package com.codestream

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class WebViewMessage(
    val type: String,
    val body: WebViewMessageBody?
)

@JsonClass(generateAdapter = true)
data class WebViewMessageBody(
    val id: String,
    val action: String,
    val params: Map<String, String>?
)