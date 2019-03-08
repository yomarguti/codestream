package com.codestream

import com.intellij.ui.ColorUtil
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.Color
import javax.swing.UIManager

class WebViewTheme(val name: String, val stylesheet: String) {

    companion object {
        fun build(): WebViewTheme {
                var bg = JBColor.background()
                val fg = JBColor.foreground()
                val border = JBColor.border()
                val link = JBColor.link()
                val scrollBarBg = UIManager.getColor("ScrollBar.background")
                val scrollBarFg = UIManager.getColor("ScrollBar.foreground")
                val buttonFocus = JBUI.CurrentTheme.Focus.defaultButtonColor()
                val font = UIUtil.getLabelFont()
                val bgImage = bg
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

                // TODO local(font.family)
                var fontFamily = if (font.family == ".SF NS Text") {
                    "-apple-system,  BlinkMacSystemFont"
                } else {
                    "\"${font.family}\""
                }

                val name = if (isDarkTheme()) "vscode-dark" else "vscode-light"
                val stylesheet = """
body {
    --app-background-color: ${bg.hex};
    --app-background-color-darker: ${bgDarker.hex};
    --app-background-color-hover: ${bgHover.hex};
    --background-color: ${bg.hex};
    --base-background-color: ${bg.hex};
    --base-border-color: ${border.hex};
    --color: ${fg.hex};
    --font-family: $fontFamily, "Segoe WPC",  "Segoe UI",  HelveticaNeue-Light,  Ubuntu,  "Droid Sans",  Arial,  Consolas,  sans-serif;
    --font-size: ${font.size};
    --font-weight: normal;
    --link-color: ${link.hex};
    --link-active-color: ${link.hex};
    --text-color: ${fg.hex};
    --text-color-highlight: ${fg.hex};
    --text-color-info-muted: ${fg.hex};
    --text-color-subtle: ${fg.hex};
    --text-color-subtle-extra: ${fg.hex};
    --tool-panel-background-color: ${bg.hex};
    --vscode-editor-background: ${bg.hex};
    --vscode-editor-foreground: ${fg.hex};
    --vscode-editor-font-family: $fontFamily;
    --vscode-editor-font-weight: normal;
    --vscode-editor-font-size: ${font.size}px;
    --vscode-button-background: ${buttonBg.hex};
    --vscode-button-hoverBackground: ${buttonFocus.hex};
    --vscode-sideBar-foreground: ${fg.hex};
    --vscode-sideBarSectionHeader-background: ${bg.hex};
    --vscode-sideBarSectionHeader-foreground: ${fg.hex};
    --vscode-textLink-foreground: ${fg.hex};
    background-color: var(--app-background-color);
    color: var(--text-color);
    font-family: var(--font-family);
    font-weight: var(--font-weight);
    font-size: var(--font-size);
    margin: 0;
    padding: 0 20px;
}

::-webkit-scrollbar {
    width: 12px;
}
::-webkit-scrollbar-track {
    background: var(--app-background-color);
}
::-webkit-scrollbar-thumb {
    background: ${scrollBarBg.hex};
}
::-webkit-scrollbar-thumb:hover {
    background: ${scrollBarFg.hex};
}

#app {
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 40"><g fill="${bgImage.hex}" fill-opacity="0.05"><path d="M20.4 19.87a4.57 4.57 0 1 0 9.13-.01 4.57 4.57 0 0 0-9.13.01z"/><path d="M26.92 6.35c-.1.1-.17.24-.17.38v5.43a7.9 7.9 0 0 1 0 15.36v5.53a.53.53 0 0 0 .92.36l11.48-12.17c.71-.76.71-1.94 0-2.7L27.67 6.38a.53.53 0 0 0-.75-.02zm-4.64.02L10.8 18.55a1.96 1.96 0 0 0 0 2.69L22.28 33.4a.53.53 0 0 0 .91-.36v-5.53a7.9 7.9 0 0 1 0-15.36V6.73a.53.53 0 0 0-.53-.52.53.53 0 0 0-.38.16z"/></g></svg>') !important;
}

.codestream .standard-form #controls .styled-select select option {
    background-color: var(--app-background-color-darker) !important;
}
        """

            return WebViewTheme(name, stylesheet)
        }
    }
}

private fun isDarkTheme() = ColorUtil.isDark(JBColor.background())

private val Color.hex: String
    get() = String.format("#%02X%02X%02X", red, green, blue)
