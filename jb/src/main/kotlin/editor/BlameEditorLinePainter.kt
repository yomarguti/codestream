package com.codestream.editor

import com.codestream.editorService
import com.codestream.extensions.textDocumentIdentifier
import com.intellij.openapi.editor.EditorLinePainter
import com.intellij.openapi.editor.LineExtensionInfo
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import java.awt.Color
import java.awt.Font

class BlameEditorLinePainter : EditorLinePainter() {

    override fun getLineExtensions(
        project: Project,
        file: VirtualFile,
        lineNumber: Int
    ): MutableCollection<LineExtensionInfo>? {
        val document = FileDocumentManager.getInstance().getDocument(file)
        val editor = FileEditorManager.getInstance(project).selectedTextEditor

        if (editor != null && editor.document == document) {
            val caretModel = editor.caretModel
            if (caretModel.isUpToDate) {
                val position = caretModel.logicalPosition
                if (position.line == lineNumber) {
                    val textDocument = document.textDocumentIdentifier ?: return null
                    val editorService = project.editorService ?: return null
                    val blame = editorService.getBlame(textDocument.uri)
                    if (blame != null) {
                        blame.elementAtOrNull(lineNumber)?.let {
                            println("CHUPACABRA getLineExtensions $lineNumber returning $it")
                            val info = LineExtensionInfo("\t$it", null, null, Color.CYAN, Font.ITALIC)
                            return mutableListOf(info)
                        }
                    }
                }
            }
        }

        return null
    }
}
