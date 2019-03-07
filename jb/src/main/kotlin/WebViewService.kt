package com.codestream

import com.github.salomonbrys.kotson.jsonObject
import com.google.gson.JsonElement
import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.ui.ColorUtil
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.teamdev.jxbrowser.chromium.Browser
import com.teamdev.jxbrowser.chromium.BrowserContext
import com.teamdev.jxbrowser.chromium.BrowserContextParams
import com.teamdev.jxbrowser.chromium.BrowserPreferences
import com.teamdev.jxbrowser.chromium.events.ScriptContextEvent
import com.teamdev.jxbrowser.chromium.events.ScriptContextListener
import com.teamdev.jxbrowser.chromium.swing.BrowserView
import org.apache.commons.io.FileUtils
import java.awt.Color
import java.io.File
import java.nio.charset.Charset
import javax.swing.UIManager


class WebViewService(val project: Project) : Disposable {

    private val url = "file:///Users/mfarias/Code/jetbrains-codestream/src/main/resources/webview/webview.html"
    private val logger = Logger.getInstance(WebViewService::class.java)
    private val router = WebViewRouter(project)
    private val browser = createBrowser(router)
    val webView = BrowserView(browser)

    init {
        val temp = createTempDir("codestream")
        logger.info("Extracting webview to ${temp.absolutePath}")
        temp.deleteOnExit()
        val htmlFile = File(temp, "webview.html")
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.html"), htmlFile)
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.js"), File(temp, "webview.js"))
        FileUtils.copyToFile(javaClass.getResourceAsStream("/webview/webview.css"), File(temp, "webview.css"))
//        browser.loadURL(url)

        for ((key, value) in UIManager.getDefaults()) {
            val strKey = key as? String ?: continue
            if (strKey.contains("button", true)) {
                println(key)
            }
        }

        generateThemeCSS(temp)

        browser.loadURL(htmlFile.toURI().toString())

//        println(font)
//        println(bgColor)
//        println(fgColor)

        UIManager.addPropertyChangeListener {
            if (it.propertyName == "lookAndFeel") {
                generateThemeCSS(temp)
                browser.loadURL(htmlFile.toURI().toString())
            }
        }
    }

    private fun generateThemeCSS(temp: File) {
        var bg = JBColor.background()
//        if (bg == JBColor.WHITE) {
//            bg = bg.darker()
//        }
        val fg = JBColor.foreground()
        val border = JBColor.border()
        val link = JBColor.link()
        val scrollBarBg = UIManager.getColor("ScrollBar.background")
        val scrollBarFg = UIManager.getColor("ScrollBar.foreground")
        val buttonFocus = JBUI.CurrentTheme.Focus.defaultButtonColor()
        val font = UIUtil.getLabelFont()
        val bgDarker = bg.darker()
        val bgHover = if (ColorUtil.isDark(bg)) {
            bg.brighter()
        } else {
            bg.darker()
        }
        var buttonBg = UIManager.getColor("Button.background")
        buttonBg = if (ColorUtil.isDark(buttonBg)) {
            buttonBg.brighter()
        } else {
            buttonBg.darker()

        }

        var fontFamily = if (font.family == ".SF NS Text") {
            "-apple-system,  BlinkMacSystemFont"
        } else {
            "\"${font.family}\""
        }

//        UIUtil.getButtonSelectColor()
//        val buttonHoverBackground = JBUI.CurrentTheme.ActionButton.hoverBackground()
//        val buttonFg = UIManager.getColor("Button.foreground")
//        val buttonSelect = UIManager.getColor("Button.select")
//        val buttonFocus = UIManager.getColor("Button.focus")
//        val panelBg = UIManager.getColor("Panel.background")
//        val panelFg = UIManager.getColor("Panel.foreground")
//        val textPaneFg = UIManager.getColor("TextPane.foreground")

        var theme = javaClass.getResource("/webview/theme.css").readText()
            .replace("--cs--app-background-color--", bg.hex)
            .replace("--cs--app-background-color-darker--", bgDarker.hex)
            .replace("--cs--app-background-color-hover--", bgHover.hex)
            .replace("--cs--background-color--", bg.hex)
            .replace("--cs--base-background-color--", bg.hex)
            .replace("--cs--base-border-color--", border.hex)
            .replace("--cs--color--", fg.hex)
            .replace("--cs--font-family--", fontFamily)
            .replace("--cs--font-size--", "${font.size}")
            .replace("--cs--link-color--", link.hex)
            .replace("--cs--text-color--", fg.hex)
            .replace("--cs--text-color-info-muted--", fg.hex)
            .replace("--cs--text-color-subtle--", fg.hex)
            .replace("--cs--text-color-subtle-extra--", fg.hex)
            .replace("--cs--tool-panel-background-color--", bg.hex)
            .replace("--cs--vscode-button-background--", buttonBg.hex)
            .replace("--cs--vscode-button-hoverBackground--", buttonFocus.hex)
            .replace("--cs--vscode-sideBarSectionHeader-background--", bg.hex)
            .replace("--cs--vscode-sideBarSectionHeader-foreground--", fg.hex)
            .replace("--cs--scrollbar-color--", scrollBarBg.hex)
            .replace("--cs--scrollbar-color-hover--", scrollBarFg.hex)
        FileUtils.write(File(temp, "theme.css"), theme, Charset.defaultCharset())
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

    fun postMessage(message: JsonElement) {
        browser.executeJavaScript("window.postMessage($message,'*');")
    }

    override fun dispose() {
        logger.info("Disposing JxBrowser")
        browser.dispose()
//        BrowserCore.shutdown()
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

private val Color.hex: String
    get() = String.format("#%02X%02X%02X", red, green, blue)




