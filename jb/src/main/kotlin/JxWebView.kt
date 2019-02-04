package com.codestream

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.teamdev.jxbrowser.chromium.Browser
import com.teamdev.jxbrowser.chromium.BrowserContext
import com.teamdev.jxbrowser.chromium.BrowserContextParams
import com.teamdev.jxbrowser.chromium.BrowserPreferences
import com.teamdev.jxbrowser.chromium.events.ConsoleListener
import com.teamdev.jxbrowser.chromium.swing.BrowserView

class JxWebView : Disposable {

    private val logger = Logger.getInstance(JxWebView::class.java)
    private val browser: Browser
    val component: BrowserView

    constructor() {
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
        component = BrowserView(browser)
    }

    fun extractContents() {
        // TODO extract assets from JAR to temp dir (or have them bundled as a single file)
    }

    fun loadURL(url: String) {
        browser.loadURL(url)
    }

    fun addConsoleListener(listener: ConsoleListener) {
        browser.addConsoleListener(listener)
    }

    override fun dispose() {
        println("JxWebView.dispose()")
        browser.dispose()
    }

}