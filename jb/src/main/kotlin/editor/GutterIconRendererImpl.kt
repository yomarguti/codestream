package com.codestream.editor

import com.codestream.codeStream
import com.codestream.extensions.ifNullOrBlank
import com.codestream.protocols.webview.CodemarkNotifications
import com.codestream.webViewService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import protocols.agent.DocumentMarker
import javax.swing.Icon

class GutterIconRendererImpl(val project: Project?, val marker: DocumentMarker) : GutterIconRenderer() {
    val id: String
        get() = marker.codemark.id

    override fun isNavigateAction(): Boolean {
        return true
    }

    override fun getClickAction(): AnAction? = object : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            project?.codeStream?.show {
                project?.webViewService?.postNotification(
                    CodemarkNotifications.Show(
                        marker.codemark.id
                    )
                )
            }
        }
    }

    override fun getTooltipText(): String? {
        return marker.summary
    }

    override fun getIcon(): Icon {
        val type = marker.codemark.type.ifNullOrBlank { "comment" }
        val color = marker.codemark.color.ifNullOrBlank { "blue" }
        return IconLoader.getIcon("/images/marker-$type-$color.svg")
    }

    override fun equals(other: Any?): Boolean {
        val otherRenderer = other as? GutterIconRendererImpl ?: return false
        return id == otherRenderer.id
    }

    override fun hashCode(): Int {
        return id.hashCode()
    }
}