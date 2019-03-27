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
            val font = UIUtil.getLabelFont()
            // TODO local(font.family)
            var fontFamily = if (font.family == ".SF NS Text") {
                "-apple-system,  BlinkMacSystemFont"
            } else {
                "\"${font.family}\""
            }

            val bg = JBColor.background()
            val fg = JBColor.foreground()
            // val border = JBColor.border()

            val textColor = opacity(fg, 80)
            val textColorHighlight = fg
            val textColorSubtle = opacity(fg, 60)
            var textColorSubtleExtra: Color

            if (ColorUtil.isDark(bg)) {
                textColorSubtleExtra = lighten(opacity(fg, 60), 50)
            } else {
                textColorSubtleExtra = darken(opacity(fg, 60), 50)
            }

            val appBgColor = bg
            var appBgColorDarker: Color
            var appBgColorHover: Color
            var baseBgColor: Color
            var baseBorderColor: Color
            var toolPanelBgColor: Color

            if (ColorUtil.isDark(bg)) {
                appBgColorDarker = darken(bg, 4)
                appBgColorHover = lighten(bg, 3)

                baseBgColor = lighten(bg, 4)
                baseBorderColor = lighten(bg, 10)
                toolPanelBgColor = lighten(bg, 10)
            } else {
                appBgColorDarker = lighten(bg, 4)
                appBgColorHover = darken(bg, 1.5.toFloat())

                baseBgColor = darken(bg, 3)
                baseBorderColor = darken(bg, 10)
                toolPanelBgColor = darken(bg, 10)
            }

            val link = JBColor.link()
            val textColorInfo = link
            var textColorInfoMuted: Color
            if (ColorUtil.isDark(bg)) {
                textColorInfoMuted = darken(link, 10)
            } else {
                textColorInfoMuted = link
            }

            val scrollBarBg = UIManager.getColor("ScrollBar.background")
            val scrollBarFg = UIManager.getColor("ScrollBar.foreground")

            val buttonFocus = JBUI.CurrentTheme.Focus.defaultButtonColor()
            var buttonBg = UIManager.getColor("Button.background")
            buttonBg = if (ColorUtil.isDark(buttonBg)) {
                buttonBg.brighter()
            } else {
                buttonBg.darker()
            }

            val name = if (isDarkTheme()) "vscode-dark" else "vscode-light"
            val stylesheet = """
body {
    --font-family: $fontFamily, "Segoe WPC", "Segoe UI", HelveticaNeue-Light, Ubuntu, "Droid Sans", Arial, Consolas, sans-serif;
    --font-size: ${font.size}px;
    --font-weight: normal;

    --app-background-color: ${appBgColor.rgba};
    --app-background-color-darker: ${appBgColorDarker.rgba};
    --app-background-color-hover: ${appBgColorHover.rgba};
    --base-background-color: ${baseBgColor.rgba};
    --base-border-color: ${baseBorderColor.rgba};
    --tool-panel-background-color: ${toolPanelBgColor.rgba};

    --text-color: ${textColor.rgba};
    --text-color-highlight: ${textColorHighlight.rgba};
    --text-color-subtle: ${textColorSubtle.rgba};
    --text-color-subtle-extra: ${textColorSubtleExtra.rgba};

    --text-color-info: ${textColorInfo.rgba};
    --text-color-info-muted: ${textColorInfoMuted.rgba};

    --scrollbar-thumb: ${scrollBarBg.rgba}
    --scrollbar-thumb-hover: ${scrollBarFg.rgba}

    --vscode-editorLineNumber-foreground: ${fg.rgba};
    --vscode-button-background: ${buttonBg.rgba};
    --vscode-button-hoverBackground: ${buttonFocus.rgba};
    --vscode-sideBar-foreground: ${fg.rgba};
    --vscode-sideBarSectionHeader-background: ${bg.rgba};
    --vscode-sideBarSectionHeader-foreground: ${fg.rgba};
}
        """

            return WebViewTheme(name, stylesheet)
        }
    }
}

private fun isDarkTheme() = ColorUtil.isDark(JBColor.background())

private fun adjustLight(color: Int, amount: Float): Int {
    val cc = color + amount
    val c: Float = if (amount < 0) (if (cc < 0) 0.toFloat() else cc) else if (cc > 255) 255.toFloat() else cc
    return Math.round(c)
}

private fun darken(color: Color, percentage: Int): Color {
    return darken(color, percentage.toFloat())
}

private fun darken(color: Color, percentage: Float): Color {
    return lighten(color, -percentage)
}

private fun lighten(color: Color, percentage: Int): Color {
    return lighten(color, percentage.toFloat())
}

private fun lighten(color: Color, percentage: Float): Color {
    val amount = (255 * percentage) / 100
    return Color(adjustLight(color.red, amount), adjustLight(color.green, amount), adjustLight(color.blue, amount), color.alpha)
}

private fun opacity(color: Color, percentage: Int): Color {
    return Color(color.red, color.green, color.blue, Math.round(255 * ((color.alpha / 255) * percentage.toFloat() / 100)))
}

private val Color.rgba: String
    get() = "rgba($red, $green, $blue, ${alpha.toFloat() / 255})"
