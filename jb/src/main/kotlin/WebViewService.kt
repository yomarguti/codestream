package com.codestream

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.teamdev.jxbrowser.chromium.*
import com.teamdev.jxbrowser.chromium.events.ScriptContextEvent
import com.teamdev.jxbrowser.chromium.events.ScriptContextListener
import com.teamdev.jxbrowser.chromium.swing.BrowserView

class WebViewService(val project: Project) : Disposable {

    val webView: BrowserView

    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser: Browser

    init {
        System.setProperty("jxbrowser.ipc.external", "true")
        BrowserPreferences.setChromiumSwitches(
            "--remote-debugging-port=9222",
//            "--disable-gpu",
//            "--disable-gpu-compositing",
//            "--enable-begin-frame-scheduling",
//            "--software-rendering-fps=60",
            "--disable-web-security",
            "--allow-file-access-from-files"
        )

        val dir = createTempDir()
        logger.info("JxBrowser work dir: $dir")

        val params = BrowserContextParams(dir.absolutePath)
        val context = BrowserContext(params)
        browser = Browser(context)
        browser.preferences.isAllowDisplayingInsecureContent = false
        browser.preferences.isAllowRunningInsecureContent = false
        browser.preferences.isAllowScriptsToCloseWindows = false
        browser.preferences.isApplicationCacheEnabled = false
        browser.preferences.isDatabasesEnabled = false
        browser.preferences.isLocalStorageEnabled = false
        browser.preferences.isPluginsEnabled = false
        browser.preferences.isTransparentBackground = true
        browser.preferences.isUnifiedTextcheckerEnabled = false
        browser.preferences.isWebAudioEnabled = false

//        browser.dialogHandler = this
//        browser.loadHandler
//        browser.context.networkService.resourceHandler

        var listener = object : ScriptContextListener {
            override fun onScriptContextDestroyed(e: ScriptContextEvent?) {
            }

            override fun onScriptContextCreated(e: ScriptContextEvent?) {
                val window = browser.executeJavaScriptAndReturnValue("window")
                window.asObject().setProperty("csRouter", router)
                browser.executeJavaScript(
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
        }

        browser.addScriptContextListener(listener)

        webView = BrowserView(browser)
        // TODO extract assets from JAR to temp dir (or have them bundled as a single file)
        val url = "file:///Users/mfarias/Code/jetbrains-codestream/src/main/resources/webview/webview.html"
        browser.loadURL(url)
    }

    fun postMessage(message: String) {
        logger.info("postMessage: $message")
        browser.executeJavaScript("window.postMessage($message,'*');")
    }

    override fun dispose() {
        logger.info("Disposing JxBrowser")
        browser?.dispose()
        BrowserCore.shutdown()
        logger.info("JxBrowser disposed")
    }

}
