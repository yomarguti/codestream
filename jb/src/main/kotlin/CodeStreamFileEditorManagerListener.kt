package com.codestream

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.text.StringUtil
import com.intellij.util.DocumentUtil
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.TextDocumentService
import javax.swing.Icon

class CodeStreamFileEditorManagerListener(private val project: Project) : FileEditorManagerListener {

    val agentService: AgentService by lazy {
        ServiceManager.getService(project, AgentService::class.java)
    }

    override fun selectionChanged(e: FileEditorManagerEvent) {
        val oldTextEditor = e.oldEditor as? TextEditor
        oldTextEditor?.apply {
            ApplicationManager.getApplication().invokeLater {
                this.editor.markupModel.removeAllHighlighters()
            }
        }

        val newTextEditor = e.newEditor as? TextEditor ?: return
        newTextEditor?.apply {
            ApplicationManager.getApplication().invokeLater {
                this.editor.markupModel.removeAllHighlighters()
            }
        }


        if (e.newEditor is TextEditor) {
            GlobalScope.launch {
                val editor = (e.newEditor as TextEditor).editor

                ApplicationManager.getApplication().invokeLater {
                    renderMarkers(e.newEditor as? TextEditor)
                }

                var textChangedJob: Job? = null
                editor.document.addDocumentListener(object : DocumentListener {
                    override fun documentChanged(event: DocumentEvent) {
                        println("Changed at ${System.currentTimeMillis()}")
                        textChangedJob?.cancel()
                        textChangedJob = GlobalScope.launch {
                            delay(500L)
                            println("Debounced changed at ${System.currentTimeMillis()}")
                            renderMarkers(e.newEditor as? TextEditor)
                        }
                    }
                })
            }
        }
    }

    fun renderMarkers (textEditor: TextEditor?) = GlobalScope.launch {
        val url = textEditor?.file?.url ?: return@launch
        val editor = textEditor.editor
        val markers = try {
            agentService.documentMarkers(url).markers
        } catch (e: Exception) {
            return@launch
        }
        ApplicationManager.getApplication().invokeLater {
            editor.markupModel.removeAllHighlighters()
            for (marker in markers) {
                val start = LSPPosToOffset(editor, marker.range.start)
                val end = LSPPosToOffset(editor, marker.range.end)
                //                                val highlighter = editor.markupModel.addRangeHighlighter(start, end, HighlighterLayer.FIRST, null, HighlighterTargetArea.EXACT_RANGE)
                val highlighter = editor.markupModel.addRangeHighlighter(
                    start,
                    end,
                    HighlighterLayer.FIRST,
                    null,
                    HighlighterTargetArea.EXACT_RANGE
                )

                val renderer = object : GutterIconRenderer() {
                    override fun getTooltipText(): String? {
                        return marker.summary
                    }

                    override fun getIcon(): Icon {
                        return IconLoader.getIcon("/images/marker-${marker.codemark.type}-${marker.codemark.color}.svg")
                    }

                    override fun equals(other: Any?): Boolean {
                        return false
                    }

                    override fun hashCode(): Int {
                        return 0
                    }

                }

                highlighter.gutterIconRenderer = renderer
            }
        }

    }



}