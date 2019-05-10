package com.codestream.extensions

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.util.text.StringUtil
import com.intellij.ui.ColorUtil
import com.intellij.util.DocumentUtil
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import protocols.webview.EditorMargins
import protocols.webview.EditorSelection
import java.awt.Font
import java.awt.Point

val Editor.displayPath: String?
    get() = FileDocumentManager.getInstance().getFile(document)?.name

fun Editor.getOffset(position: Position): Int {
    val line = position.line
    val lineText = document.getText(DocumentUtil.getLineTextRange(document, line))
    val endIndex = Math.min(lineText.length, position.character)
    val lineTextForPosition = lineText.substring(0, endIndex)
    val tabs = StringUtil.countChars(lineTextForPosition, '\t')
    val tabSize = settings.getTabSize(project)
    val column = tabs * tabSize + lineTextForPosition.length - tabs
    val offset = logicalPositionToOffset(LogicalPosition(line, column))
    if (position.character >= lineText.length) {
        // println("LSPPOS outofbounds : $pos line : $lineText column : $column offset : $offset")
    }
    val docLength = document.textLength
    if (offset > docLength) {
        println("Offset greater than text length : $offset > $docLength")
    }
    return Math.min(Math.max(offset, 0), docLength)
}

val Editor.margins: EditorMargins
    get() = EditorMargins(0, 0, 0, 0)

val Editor.selections: List<EditorSelection>
    get() {
        return listOf(
            EditorSelection(
                document.lspPosition(selectionModel.selectionStart),
                document.lspPosition(selectionModel.selectionEnd),
                document.lspPosition(caretModel.offset)
            )
        )
    }

val Editor.highlightTextAttributes: TextAttributes
    get() {
        val bg = colorsScheme.defaultBackground
        val highlight =
            if (ColorUtil.isDark(bg)) bg.lighten(7)
            else bg.darken(7)
        return TextAttributes(
            null,
            highlight,
            null,
            null,
            Font.PLAIN
        )
    }

val Editor.selectionOrCurrentLine: Range
    get() = if (selectionModel.hasSelection()) {
        Range(document.lspPosition(selectionModel.selectionStart), document.lspPosition(selectionModel.selectionEnd))
    } else {
        val logicalPos = caretModel.currentCaret.logicalPosition
        val startOffset = logicalPositionToOffset(LogicalPosition(logicalPos.line, 0))
        val endOffset = logicalPositionToOffset(LogicalPosition(logicalPos.line, Int.MAX_VALUE))
        Range(document.lspPosition(startOffset), document.lspPosition(endOffset))
    }

val Editor.visibleRanges: List<Range>
    get() {
        val visibleArea = scrollingModel.visibleArea

        val viewportStartPoint = visibleArea.location
        val startLogicalPos = xyToLogicalPosition(viewportStartPoint)
        val startOffset = logicalPositionToOffset(startLogicalPos)
        val startLspPos = document.lspPosition(startOffset)

        val viewportEndPoint = Point(
            visibleArea.location.x + visibleArea.width,
            visibleArea.location.y + visibleArea.height
        )
        val endLogicalPos = xyToLogicalPosition(viewportEndPoint)

        val fullRange = Range(
            startLspPos,
            Position(endLogicalPos.line, endLogicalPos.column)
        )

        val ranges = mutableListOf<Range>()
        var range = Range(fullRange.start, fullRange.end)

        val collapsedRegions = foldingModel.allFoldRegions.filter { !it.isExpanded }
        for (collapsed in collapsedRegions) {
            if (collapsed.end < fullRange.start) {
                continue
            }
            if (collapsed.start > fullRange.end) {
                break
            }

            val previousExpandedOffset = getOffset(collapsed.start) - 1
            range.end = document.lspPosition(previousExpandedOffset)
            if (range.start < range.end) {
                ranges += range
            }

            val nextExpandedOffset = getOffset(collapsed.end) + 1
            range = Range()
            range.start = document.lspPosition(nextExpandedOffset)
            range.end = fullRange.end
        }

        ranges += range

        return ranges
    }

fun Editor.isRangeVisible(range: Range): Boolean {
    val ranges = this.visibleRanges
    val firstRange = ranges.first()
    val lastRange = ranges.last()
    return range.start.line >= firstRange.start.line && range.end.line <= lastRange.end.line
}
