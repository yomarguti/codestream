package com.codestream.widgets

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetProvider

class CodeStreamStatusBarWidgetProvider : StatusBarWidgetProvider {
    override fun getWidget(project: Project): StatusBarWidget? {
        return CodeStreamStatusBarWidget(project)
    }
}
