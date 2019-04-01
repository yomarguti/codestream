package com.codestream

import com.codestream.editor.getFontScale
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
            val border = JBColor.border()
            val link = JBColor.link()
            val buttonBg = JBUI.CurrentTheme.Focus.defaultButtonColor()
            val scrollBarBg = UIManager.getColor("ScrollBar.background")
            val scrollBarFg = UIManager.getColor("ScrollBar.foreground")

            val appBgColor = bg
            var appBgColorDarker: Color
            var appBgColorHover: Color
            var baseBgColor: Color
            var baseBorderColor: Color
            var panelToolBgColor: Color
            val panelSectionFgColor = opacity(fg, 80)
            val panelSectionHeaderBgColor = bg;
            val panelSectionHeaderFgColor = opacity(fg, 80)
            val textColor = opacity(fg, 80)
            val textColorHighlight = fg
            val textColorSubtle = opacity(fg, 60)
            var textColorSubtleExtra: Color
            val textColorInfo = link
            var textColorInfoMuted: Color
            val lineNumbersFgColor = opacity(fg, 40)
            val buttonBgColor = buttonBg
            var buttonBgColorHover: Color

            if (ColorUtil.isDark(bg)) {
                appBgColorDarker = darken(bg, 4)
                appBgColorHover = lighten(bg, 3)

                baseBgColor = lighten(bg, 4)
                baseBorderColor = lighten(opacity(border, 50), 20)

                panelToolBgColor = lighten(bg, 10)

                textColorSubtleExtra = lighten(opacity(fg, 60), 50)

                textColorInfoMuted = darken(link, 10)

                buttonBgColorHover = lighten(buttonBg, 10)
            } else {
                appBgColorDarker = lighten(bg, 4)
                appBgColorHover = darken(bg, 1.5.toFloat())

                baseBgColor = darken(bg, 3)
                baseBorderColor = lighten(opacity(border, 50), 3)

                panelToolBgColor = darken(bg, 10)

                textColorSubtleExtra = darken(opacity(fg, 60), 50)

                textColorInfoMuted = link

                buttonBgColorHover = darken(buttonBg, 10)
            }

            val name = if (isDarkTheme()) "vscode-dark" else "vscode-light"
            val fontSize = Math.round(font.size / getFontScale())
            val stylesheet = """
body {
    --font-family: $fontFamily, "Segoe WPC", "Segoe UI", HelveticaNeue-Light, Ubuntu, "Droid Sans", Arial, Consolas, sans-serif;
    --font-size: ${fontSize}px;
    --font-weight: normal;

    --border-color: ${border.rgba};

    --text-color: ${textColor.rgba};
    --text-color-highlight: ${textColorHighlight.rgba};
    --text-color-subtle: ${textColorSubtle.rgba};
    --text-color-subtle-extra: ${textColorSubtleExtra.rgba};

    --text-color-info: ${textColorInfo.rgba};
    --text-color-info-muted: ${textColorInfoMuted.rgba};

    --app-background-color: ${appBgColor.rgba};
    --app-background-color-darker: ${appBgColorDarker.rgba};
    --app-background-color-hover: ${appBgColorHover.rgba};

    --base-background-color: ${baseBgColor.rgba};
    --base-border-color: ${baseBorderColor.rgba};

    --panel-tool-background-color: ${panelToolBgColor.rgba};
    --panel-section-foreground-color: ${panelSectionFgColor.rgba};
    --panel-section-header-background-color: ${panelSectionHeaderBgColor.rgba};
    --panel-section-header-foreground-color: ${panelSectionHeaderFgColor.rgba};

    --line-numbers-foreground-color: ${lineNumbersFgColor.rgba};

    --button-background-color: ${buttonBgColor.rgba};
    --button-background-color-hover: ${buttonBgColorHover.rgba};

    --scrollbar-thumb: ${scrollBarBg.rgba}
    --scrollbar-thumb-hover: ${scrollBarFg.rgba}
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
