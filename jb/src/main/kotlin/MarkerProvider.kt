package com.codestream

import com.intellij.codeInsight.daemon.LineMarkerInfo
import com.intellij.codeInsight.daemon.LineMarkerProvider
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement

class MarkerProvider: LineMarkerProvider {

    override fun collectSlowLineMarkers(
        elements: MutableList<PsiElement>,
        result: MutableCollection<LineMarkerInfo<PsiElement>>
    ) {
        println("chupacabra 1")
//        result.
    }

    override fun getLineMarkerInfo(element: PsiElement): LineMarkerInfo<*> {
        element.containingFile
        println("chupacabra 2")
        return LineMarkerInfo(element, TextRange.create(0, 1), IconLoader.getIcon("/images/codestream.svg"), 1, null, null, GutterIconRenderer.Alignment.LEFT)
    }

}