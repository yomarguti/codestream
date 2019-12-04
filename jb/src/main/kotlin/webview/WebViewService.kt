package com.codestream.webview

import com.codestream.DEBUG
import com.codestream.WEBVIEW_PATH
import com.codestream.gson
import com.codestream.protocols.webview.WebViewNotification
import com.codestream.settingsService
import com.github.salomonbrys.kotson.jsonObject
import com.google.gson.JsonElement
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.teamdev.jxbrowser.chromium.Browser
import com.teamdev.jxbrowser.chromium.BrowserContext
import com.teamdev.jxbrowser.chromium.BrowserContextParams
import com.teamdev.jxbrowser.chromium.BrowserPreferences
import com.teamdev.jxbrowser.chromium.BrowserType
import com.teamdev.jxbrowser.chromium.CertificateErrorParams
import com.teamdev.jxbrowser.chromium.CertificatesDialogParams
import com.teamdev.jxbrowser.chromium.CloseStatus
import com.teamdev.jxbrowser.chromium.ColorChooserParams
import com.teamdev.jxbrowser.chromium.DialogHandler
import com.teamdev.jxbrowser.chromium.DialogParams
import com.teamdev.jxbrowser.chromium.FileChooserParams
import com.teamdev.jxbrowser.chromium.LoadHandler
import com.teamdev.jxbrowser.chromium.LoadParams
import com.teamdev.jxbrowser.chromium.PromptDialogParams
import com.teamdev.jxbrowser.chromium.ReloadPostDataParams
import com.teamdev.jxbrowser.chromium.ResourceHandler
import com.teamdev.jxbrowser.chromium.ResourceParams
import com.teamdev.jxbrowser.chromium.ResourceType
import com.teamdev.jxbrowser.chromium.UnloadDialogParams
import com.teamdev.jxbrowser.chromium.events.ScriptContextEvent
import com.teamdev.jxbrowser.chromium.events.ScriptContextListener
import com.teamdev.jxbrowser.chromium.swing.BrowserView
import org.apache.commons.io.FileUtils
import java.io.File
import java.nio.charset.Charset
import java.util.concurrent.atomic.AtomicInteger
import javax.swing.UIManager

class WebViewService(val project: Project) : Disposable, DialogHandler, LoadHandler, ResourceHandler {
    private val utf8 = Charset.forName("UTF-8")
    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser = createBrowser(router)
    val webView = BrowserView(browser)
    private lateinit var tempDir: File
    private lateinit var extractedHtmlFile: File

    private val htmlFile: File get() = if (WEBVIEW_PATH != null) {
        File(WEBVIEW_PATH)
    } else {
        extractedHtmlFile
    }

    init {
        logger.info("Initializing WebViewService for project ${project.basePath}")
        extractAssets()
        applyStylesheet()

        UIManager.addPropertyChangeListener {
            if (it.propertyName == "lookAndFeel") {
                applyStylesheet()
                browser.loadURL(htmlFile.url)
            }
        }
    }

    companion object {
        private var debugPortSeed = AtomicInteger(9222)
        private val debugPort get() = debugPortSeed.getAndAdd(1)
    }

    fun onDidInitialize(cb: () -> Unit) {
        if (router.initialization.isDone) cb()
        else router.initialization.thenRun(cb)
    }

    fun load(resetContext: Boolean = false) {
        logger.info("Loading WebView")
        if (resetContext) {
            project.settingsService?.clearWebViewContext()
        }
        browser.loadURL(htmlFile.url)
    }

    private fun extractAssets() {
        tempDir = createTempDir("codestream")
        logger.info("Extracting webview to ${tempDir.absolutePath}")
        tempDir.deleteOnExit()
        extractedHtmlFile = File(tempDir, "webview.html")

        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.js"), File(tempDir, "webview.js"))
        FileUtils.copyToFile(
            javaClass.getResourceAsStream("/webview/webview-data.js"),
            File(tempDir, "webview-data.js")
        )
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.css"), File(tempDir, "webview.css"))
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.html"), File(tempDir, "webview.html"))
    }

    private fun applyStylesheet() {
        val theme = WebViewTheme.build()
        val htmlContent = FileUtils.readFileToString(htmlFile, utf8)
            .replace("{bodyClass}", theme.name)
            .replace("<style id=\"theme\"></style>", "<style id=\"theme\">${theme.stylesheet}</style>")
        FileUtils.write(htmlFile, htmlContent, utf8)
    }

    fun postResponse(id: String, params: Any?, error: String? = null) {
        val message = jsonObject(
            "id" to id,
            "params" to gson.toJsonTree(params),
            "error" to error
        )
        postMessage(message, true)
    }

    fun postNotification(notification: WebViewNotification, force: Boolean? = false) {
        logger.debug("Posting ${notification.getMethod()}")
        val message = jsonObject(
            "method" to notification.getMethod(),
            "params" to gson.toJsonTree(notification)
        )
        postMessage(message, force)
    }

    fun postNotification(method: String, params: Any?, force: Boolean? = false) {
        logger.debug("Posting $method")
        val message = jsonObject(
            "method" to method,
            "params" to gson.toJsonTree(params)
        )
        postMessage(message, force)
    }

    private fun postMessage(message: JsonElement, force: Boolean? = false) {
        if (router.isReady || force == true) browser.executeJavaScript("window.postMessage($message,'*');")
    }

    override fun dispose() {
        logger.info("Disposing WebViewService for project ${project.basePath}")
        browser.dispose()
//        BrowserCore.shutdown()
    }

    private fun createBrowser(router: WebViewRouter): Browser {
        configureJxBrowser()
        val browser = Browser(BrowserType.LIGHTWEIGHT, createBrowserContext())
        browser.dialogHandler = this
        browser.loadHandler = this
        browser.context.networkService.resourceHandler = this
        browser.configurePreferences()
        browser.connectRouter(router)

        return browser
    }

    private fun configureJxBrowser() {
        System.setProperty("jxbrowser.ipc.external", "true")
        BrowserPreferences.setChromiumSwitches(
            if (DEBUG || WEBVIEW_PATH != null) {
                "--remote-debugging-port=$debugPort"
            } else {
                ""
            },
            "--disable-gpu",
            "--disable-gpu-compositing",
            "--enable-begin-frame-scheduling",
            "--software-rendering-fps=60",
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
                        window.acquireHostApi = function() {
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

    override fun canLoadResource(params: ResourceParams?): Boolean {
        params?.let {
            if (it.resourceType == ResourceType.IMAGE || params.url.startsWith("file://")) {
                return true
            }
            if (params.resourceType == ResourceType.MAIN_FRAME) {
                BrowserUtil.browse(params.url)
            }
        }

        return false
    }

    override fun onLoad(params: LoadParams?) = false
    override fun onCertificateError(params: CertificateErrorParams?) = false
    override fun onBeforeUnload(params: UnloadDialogParams?) = CloseStatus.CANCEL
    override fun onAlert(params: DialogParams?) = Unit
    override fun onConfirmation(params: DialogParams?) = CloseStatus.CANCEL
    override fun onFileChooser(params: FileChooserParams?) = CloseStatus.CANCEL
    override fun onPrompt(params: PromptDialogParams?) = CloseStatus.CANCEL
    override fun onReloadPostData(params: ReloadPostDataParams?) = CloseStatus.CANCEL
    override fun onColorChooser(params: ColorChooserParams?) = CloseStatus.CANCEL
    override fun onSelectCertificate(params: CertificatesDialogParams?) = CloseStatus.CANCEL
}

private val File.url: String
    get() = toURI().toURL().toString()




