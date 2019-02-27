package com.codestream

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.util.DocumentUtil
import org.eclipse.lsp4j.Position

/**
 * Calculates a Position given an editor and an offset
 *
 * @param editor The editor
 * @param offset The offset
 * @return an LSP position
 */
fun offsetToLSPPos(editor: Editor, offset: Int): Position {
    val doc = editor.document
    val line = doc.getLineNumber(offset)
    val lineStart = doc.getLineStartOffset(line)
    val lineTextBeforeOffset = doc.getText(TextRange.create(lineStart, offset))
    val column = lineTextBeforeOffset.length
    return Position(line, column)
}

/**
 * Transforms an LSP position to an editor offset
 *
 * @param editor The editor
 * @param pos    The LSPPos
 * @return The offset
 */
fun LSPPosToOffset(editor: Editor, pos: Position): Int {
    val line = pos.line
    val doc = editor.document
    val lineText = doc.getText(DocumentUtil.getLineTextRange(doc, line))
    val lineTextForPosition = lineText.substring(0, Math.min(lineText.length, pos.character))
    val tabs = StringUtil.countChars(lineTextForPosition, '\t')
    val tabSize = editor.settings.getTabSize(editor.project)
    val column = tabs * tabSize + lineTextForPosition.length - tabs
    val offset = editor.logicalPositionToOffset(LogicalPosition(line, column))
    if (pos.character >= lineText.length) {
        println("LSPPOS outofbounds : $pos line : $lineText column : $column offset : $offset")
    }
    val docLength = doc.textLength
    if (offset > docLength) {
        println("Offset greater than text length : $offset > $docLength")
    }
    return Math.min(Math.max(offset, 0), docLength)
}