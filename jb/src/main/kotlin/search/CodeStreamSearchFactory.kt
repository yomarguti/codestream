package com.codestream.search

import com.intellij.ide.actions.searcheverywhere.SearchEverywhereContributor
import com.intellij.ide.actions.searcheverywhere.SearchEverywhereContributorFactory
import com.intellij.openapi.actionSystem.AnActionEvent

class CodeStreamSearchFactory : SearchEverywhereContributorFactory<CodeStreamSearchItem> {
    override fun createContributor(initEvent: AnActionEvent): SearchEverywhereContributor<CodeStreamSearchItem> {
        return CodeStreamSearch(initEvent.project)
    }
}
