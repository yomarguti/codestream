package com.codestream.actions

import com.codestream.agentService
import com.codestream.editorService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import protocols.agent.TextDocumentFromKeyParams

abstract class Bookmark(val key: Int) : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        GlobalScope.launch {
            val project = e.project ?: return@launch
            val agentService = project.agentService ?: return@launch
            val editorService = project.editorService ?: return@launch
            val result = agentService.agent.textDocumentFromKey(TextDocumentFromKeyParams(key)).await()
            result?.let {
                editorService.reveal(it.textDocument.uri, it.range)
            }
        }
    }
}

class Bookmark1 : Bookmark(1)
class Bookmark2 : Bookmark(2)
class Bookmark3 : Bookmark(3)
class Bookmark4 : Bookmark(4)
class Bookmark5 : Bookmark(5)
class Bookmark6 : Bookmark(6)
class Bookmark7 : Bookmark(7)
class Bookmark8 : Bookmark(8)
class Bookmark9 : Bookmark(9)
