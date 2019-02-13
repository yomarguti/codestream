package com.codestream

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Bootstrap(
    val capabilities: Capabilities,
    val configs: Configs,
    val env: String,
    val version: String
)
