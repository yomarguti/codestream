package com.codestream.webview

import com.codestream.DEBUG
import com.codestream.gson
import com.codestream.protocols.webview.WebViewNotification
import com.github.salomonbrys.kotson.jsonObject
import com.google.gson.JsonElement
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.teamdev.jxbrowser.browser.Browser
import com.teamdev.jxbrowser.browser.callback.InjectJsCallback
import com.teamdev.jxbrowser.engine.Engine
import com.teamdev.jxbrowser.engine.EngineOptions
import com.teamdev.jxbrowser.engine.RenderingMode
import com.teamdev.jxbrowser.js.JsObject
import com.teamdev.jxbrowser.net.ResourceType
import com.teamdev.jxbrowser.net.callback.LoadResourceCallback
import com.teamdev.jxbrowser.plugin.callback.AllowPluginCallback
import com.teamdev.jxbrowser.view.swing.BrowserView
import org.apache.commons.io.FileUtils
import java.io.File
import java.nio.charset.Charset
import java.nio.file.Paths
import javax.swing.UIManager

class WebViewService(val project: Project) : Disposable {
    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser = createBrowser(router)
    val webView: BrowserView = BrowserView.newInstance(browser)
    private val messageQueue = ArrayList<JsonElement>()

    private lateinit var tempDir: File
    private lateinit var htmlFile: File

    init {
        router.onWebviewReady { flushMessageQueue() }

        extractAssets()
        browser.navigation().loadUrl(htmlFile.url)

        UIManager.addPropertyChangeListener {
            if (it.propertyName == "lookAndFeel") {
                extractHtml()
                browser.navigation().loadUrl(htmlFile.url)
            }
        }
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
        var htmlContent = javaClass.getResource("/webview/webview.html")
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

    fun postNotification(method: String, params: Any?) {
        val message = jsonObject(
            "method" to method,
            "params" to gson.toJsonTree(params)
        )
        postMessage(message)
    }

    private fun postMessage(message: JsonElement, force: Boolean? = false) {
        if (router.isReady || force == true) browser.mainFrame().ifPresent {
            it.executeJavaScript<Unit>("window.postMessage($message,'*');")
        }
        else enqueueMessage(message)
    }

    private fun enqueueMessage(message: JsonElement) {
        if (messageQueue.count() > 100) return

        messageQueue.add(message)
    }

    private fun flushMessageQueue() {
        if (messageQueue.count() > 100) {
            messageQueue.clear()
            router.reload()
            reload()
        } else {
            while (messageQueue.count() > 0) {
                val message = messageQueue.first()
                browser.mainFrame().ifPresent {
                    it.executeJavaScript<Unit>("window.postMessage($message,'*');")
                }
                messageQueue.remove(message)
            }
        }
    }

    override fun dispose() {
        logger.info("Disposing JxBrowser")
        browser.close()
        browser.engine().close()
    }

    fun reload() {
        browser.navigation().loadUrl(htmlFile.url)
    }

    private fun createBrowser(router: WebViewRouter): Browser {
        val dir = createTempDir()
        logger.info("JxBrowser work dir: $dir")
        val optionsBuilder = EngineOptions
            .newBuilder(RenderingMode.OFF_SCREEN)
            .licenseKey("6P835FT5H9Q596QEMRZTTB0RYSG7H1P664XU2Y2M9QPOA998OY42K6N3OTUO90SSP5BA")
            .userDataDir(Paths.get(dir.toURI()))
            // .disableGpu()
            // .disableWebSecurity()
            .allowFileAccessFromFiles()
            // .addSwitch("--disable-gpu-compositing")
            // .addSwitch("--enable-begin-frame-scheduling")
            // .addSwitch("--software-rendering-fps=60")
            //     if (JreHiDpiUtil.isJreHiDPIEnabled() && !SystemInfo.isMac) "--force-device-scale-factor=1" else ""

        if (DEBUG) {
            optionsBuilder.remoteDebuggingPort(9222)
        }

        val options = optionsBuilder.build()
        val engine = Engine.newInstance(options)
        engine.network()
        engine.spellChecker().disable()
        engine.plugins().set(AllowPluginCallback::class.java, AllowPluginCallback { AllowPluginCallback.Response.deny() })
        engine.network().set(LoadResourceCallback::class.java, LoadResourceCallback {
            if (it.resourceType() == ResourceType.IMAGE || it.url().startsWith("file://")) {
                LoadResourceCallback.Response.load()
            } else {
                if (it.resourceType() == ResourceType.MAIN_FRAME) {
                    BrowserUtil.browse(it.url())
                }
                LoadResourceCallback.Response.cancel()
            }
        })

        val browser = engine.newBrowser()
        // browser.audio().mute()
        // browser.set(ConfirmCallback::class.java, ConfirmCallback { _, tell -> tell.cancel() })
        // browser.set(CertificateErrorCallback::class.java, CertificateErrorCallback { _, action -> action.deny() })
        // browser.set(BeforeUnloadCallback::class.java, BeforeUnloadCallback { _, action -> action.stay() })
        // browser.set(AlertCallback::class.java, AlertCallback { _, action -> action.ok() })
        // browser.set(ConfirmCallback::class.java, ConfirmCallback { _, action -> action.cancel() })
        // browser.set(OpenFileCallback::class.java, OpenFileCallback { _, action -> action.cancel() })
        // browser.set(OpenFilesCallback::class.java, OpenFilesCallback { _, action -> action.cancel() })
        // browser.set(OpenFolderCallback::class.java, OpenFolderCallback { _, action -> action.cancel() })
        // browser.set(PromptCallback::class.java, PromptCallback { _, action -> action.cancel() })
        // browser.set(SelectColorCallback::class.java, SelectColorCallback { _, action -> action.cancel() })
        // browser.set(SelectClientCertificateCallback::class.java, SelectClientCertificateCallback { _, action -> action.cancel() })
        browser.connectRouter(router)

        return browser
    }

    // private fun Browser.configurePreferences() {
    //     preferences.apply {
    //         isAllowDisplayingInsecureContent = false
    //         isAllowRunningInsecureContent = false
    //         isAllowScriptsToCloseWindows = false
    //         isApplicationCacheEnabled = false
    //         isDatabasesEnabled = false
    //         isLocalStorageEnabled = false
    //         isTransparentBackground = true
    //     }
    // }

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




