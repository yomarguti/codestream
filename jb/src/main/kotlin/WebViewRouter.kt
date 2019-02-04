package com.codestream

import com.intellij.openapi.diagnostic.Logger
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.teamdev.jxbrowser.chromium.events.ConsoleEvent
import com.teamdev.jxbrowser.chromium.events.ConsoleListener

val moshi: Moshi = Moshi.Builder()
    .add(KotlinJsonAdapterFactory())
//    .add(Date::class.java, Rfc3339DateJsonAdapter().nullSafe())
    .build()
val webViewMessageAdapter: JsonAdapter<WebViewMessage> = moshi.adapter(WebViewMessage::class.java)


class WebViewRouter : ConsoleListener {
    val logger = Logger.getInstance(WebViewRouter::class.java)


    override fun onMessage(e: ConsoleEvent?) {
        if (e?.message == null || !e.message.startsWith("{")) {
            return
        }

        val webViewMessage = parse(e.message) ?: return
        when (webViewMessage.type) {
            "bootstrap",
            "authenticate",
            "go-to-signup",
            "go-to-slack-signin",
            "validate-signup" -> {
                logger.info("when in")
            }
            else -> {
                logger.info("when else")
            }
        }

        logger.info(webViewMessage.toString())
    }

    private fun parse(json: String): WebViewMessage? = webViewMessageAdapter.fromJson(json)

}