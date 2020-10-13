package com.codestream.search

import com.codestream.agentService
import com.codestream.protocols.agent.GetCodemarksParams
import com.intellij.ide.actions.searcheverywhere.SearchEverywhereContributor
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.project.Project
import com.intellij.util.Processor
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import javax.swing.JLabel
import javax.swing.ListCellRenderer

class CodeStreamSearch(val project: Project?) : SearchEverywhereContributor<CodeStreamSearchItem> {
    override fun getSearchProviderId(): String {
        return this::class.java.simpleName
    }

    override fun getGroupName(): String = "CodeStream"

    override fun getSortWeight(): Int = 50

    override fun showInFindResults(): Boolean = true

    override fun isShownInSeparateTab(): Boolean = true

    override fun fetchElements(
        pattern: String,
        progressIndicator: ProgressIndicator,
        consumer: Processor<in CodeStreamSearchItem>
    ) {
        GlobalScope.launch {
            val result = project?.agentService?.getCodemarks(GetCodemarksParams(pattern)) ?: return@launch
            result.codemarks.forEach { consumer.process(CodeStreamSearchItem(it)) }
        }
    }

    override fun processSelectedItem(selected: CodeStreamSearchItem, modifiers: Int, searchText: String): Boolean {
        TODO("Not yet implemented")
    }

    override fun getElementsRenderer(): ListCellRenderer<in CodeStreamSearchItem> {
        return ListCellRenderer { list, value, index, isSelected, cellHasFocus ->
            JLabel(value.codemark.text)
        }
    }

    override fun getDataForItem(element: CodeStreamSearchItem, dataId: String): Any? {
        TODO("Not yet implemented")
    }
}
