package com.codestream

data class WebViewMessage(
    val type: String,
    val body: WebViewMessageBody
)

data class WebViewMessageBody(
    val id: String,
    val action: String
)