package com.codestream

import com.github.salomonbrys.kotson.jsonObject
import com.google.gson.JsonElement
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.teamdev.jxbrowser.chromium.*
import com.teamdev.jxbrowser.chromium.events.ScriptContextEvent
import com.teamdev.jxbrowser.chromium.events.ScriptContextListener
import com.teamdev.jxbrowser.chromium.swing.BrowserView


class WebViewService(val project: Project) : Disposable {

    private val url = "file:///Users/mfarias/Code/jetbrains-codestream/src/main/resources/webview/webview.html"
    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser = createBrowser(router)
    val webView = BrowserView(browser)

    init {
        // TODO extract assets from JAR to temp dir (or load them directly from JAR if possible)
        browser.loadURL(url)
    }


    fun postResponse(id: String, payload: Any?, error: String? = null) {
        val message = jsonObject(
            "type" to "codestream:response",
            "body" to jsonObject(
                "id" to id,
                "payload" to gson.toJsonTree(payload),
                "error" to error
            )
        )
        postMessage(message)
    }

    fun postData(payload: JsonElement) {
        val message = jsonObject(
            "type" to "codestream:data",
            "body" to payload
        )
        postMessage(message)
    }

    private fun postMessage(message: JsonElement) {
        browser.executeJavaScript("window.postMessage($message,'*');")
    }

    override fun dispose() {
        logger.info("Disposing JxBrowser")
        browser.dispose()
        BrowserCore.shutdown()
    }

    fun reload() {
        browser.loadURL(url)
    }

    private fun createBrowser(router: WebViewRouter): Browser {
        configureJxBrowser()
        val browser = Browser(createBrowserContext())
        browser.configurePreferences()
        browser.connectRouter(router)

        //        browser.dialogHandler = this
        //        browser.loadHandler
        //        browser.context.networkService.resourceHandler

        return browser
    }

    private fun configureJxBrowser() {
        System.setProperty("jxbrowser.ipc.external", "true")
        BrowserPreferences.setChromiumSwitches(
            "--remote-debugging-port=9222",
            //        "--disable-gpu",
            //        "--disable-gpu-compositing",
            //        "--enable-begin-frame-scheduling",
            //        "--software-rendering-fps=60",
            "--disable-web-security",
            "--allow-file-access-from-files"
        )
    }

    private fun createBrowserContext(): BrowserContext {
        val dir = createTempDir()
        logger.info("JxBrowser work dir: $dir")
        val params = BrowserContextParams(dir.absolutePath)
        return BrowserContext(params)
    }

    private fun Browser.configurePreferences() {
        preferences.apply {
            isAllowDisplayingInsecureContent = false
            isAllowRunningInsecureContent = false
            isAllowScriptsToCloseWindows = false
            isApplicationCacheEnabled = false
            isDatabasesEnabled = false
            isLocalStorageEnabled = false
            isPluginsEnabled = false
            isTransparentBackground = true
            isUnifiedTextcheckerEnabled = false
            isWebAudioEnabled = false
        }
    }

    private fun Browser.connectRouter(router: WebViewRouter) {
        addScriptContextListener(object : ScriptContextListener {
            override fun onScriptContextDestroyed(e: ScriptContextEvent?) {
            }

            override fun onScriptContextCreated(e: ScriptContextEvent?) {
                val window = executeJavaScriptAndReturnValue("window")
                window.asObject().setProperty("csRouter", router)
                executeJavaScript(
                    """
                        window.acquireVsCodeApi = function() {
                            return {
                                postMessage: function(message, origin) {
                                    window.csRouter.handle(JSON.stringify(message), origin);
                                }
                            }
                        }
                        """.trimIndent()
                )
            }
        })
    }

}




