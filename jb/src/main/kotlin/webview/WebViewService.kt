package com.codestream.webview

import com.codestream.gson
import com.codestream.protocols.webview.WebViewNotification
import com.github.salomonbrys.kotson.jsonObject
import com.google.gson.JsonElement
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.teamdev.jxbrowser.browser.Browser
import com.teamdev.jxbrowser.browser.callback.InjectJsCallback
import com.teamdev.jxbrowser.js.JsObject
import com.teamdev.jxbrowser.view.swing.BrowserView
import org.apache.commons.io.FileUtils
import java.io.File
import java.nio.charset.Charset
import javax.swing.UIManager

class WebViewService(val project: Project) : Disposable {
    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser = createBrowser(router)
    private lateinit var tempDir: File
    private lateinit var htmlFile: File

    init {
        extractAssets()

        UIManager.addPropertyChangeListener {
            if (it.propertyName == "lookAndFeel") {
                extractHtml()
                browser.navigation().loadUrl(htmlFile.url)
            }
        }
    }

    val webView: BrowserView by lazy {
        BrowserView.newInstance(browser)
    }

    fun load() {
        logger.info("Loading WebView")
        browser.navigation().loadUrl(htmlFile.url)
    }

    private fun extractAssets() {
        tempDir = createTempDir("codestream")
        logger.info("Extracting webview to ${tempDir.absolutePath}")
        tempDir.deleteOnExit()
        htmlFile = File(tempDir, "webview.html")

        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.js"), File(tempDir, "webview.js"))
        FileUtils.copyToFile(
            javaClass.getResourceAsStream("/webview/webview-data.js"),
            File(tempDir, "webview-data.js")
        )
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.css"), File(tempDir, "webview.css"))
        extractHtml()
    }

    private fun extractHtml() {
        val theme = WebViewTheme.build()
        val htmlContent = javaClass.getResource("/webview/webview.html")
            .readText()
            .replace("{bodyClass}", theme.name)
            .replace("<style id=\"theme\"></style>", "<style id=\"theme\">${theme.stylesheet}</style>")
        FileUtils.write(htmlFile, htmlContent, Charset.forName("UTF-8"))
    }

    fun postResponse(id: String, params: Any?, error: String? = null) {
        val message = jsonObject(
            "id" to id,
            "params" to gson.toJsonTree(params),
            "error" to error
        )
        postMessage(message, true)
    }

    fun postNotification(notification: WebViewNotification) {
        val message = jsonObject(
            "method" to notification.getMethod(),
            "params" to gson.toJsonTree(notification)
        )
        postMessage(message)
    }

    fun postNotification(method: String, params: Any?, force: Boolean? = false) {
        val message = jsonObject(
            "method" to method,
            "params" to gson.toJsonTree(params)
        )
        postMessage(message, force)
    }

    private fun postMessage(message: JsonElement, force: Boolean? = false) {
        if (router.isReady || force == true) browser.mainFrame().ifPresent {
            it.executeJavaScript<Unit>("window.postMessage($message,'*');")
        }
    }

    override fun dispose() {
        logger.info("Disposing JxBrowser instance")
        browser.close()
    }

    private fun createBrowser(router: WebViewRouter): Browser {
        val engine = ServiceManager.getService(BrowserEngineService::class.java)
        val browser = engine.newBrowser()

        browser.connectRouter(router)

        return browser
    }

    private fun Browser.connectRouter(router: WebViewRouter) {

        set(InjectJsCallback::class.java, InjectJsCallback {
            val frame = it.frame()

            val window = frame.executeJavaScript<JsObject>("window")!!
            window.putProperty("csRouter", router)

            frame.executeJavaScript<Unit>(
                """
                    window.acquireHostApi = function() {
                        return {
                            postMessage: function(message, origin) {
                                window.csRouter.handle(JSON.stringify(message), origin);
                            }
                        }
                    }
                    """.trimIndent()
            )

            InjectJsCallback.Response.proceed()
        })
    }
}

private val File.url: String
    get() = toURI().toURL().toString()




