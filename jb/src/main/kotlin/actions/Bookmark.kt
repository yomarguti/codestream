package com.codestream.actions

import com.codestream.AgentService
import com.codestream.TextDocumentFromKeyParams
import com.codestream.editor.EditorService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.ServiceManager
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch

abstract class Bookmark(val key: Int) : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        GlobalScope.launch {
            val project = e.project ?: return@launch
            val agentService = ServiceManager.getService(project, AgentService::class.java)
            val editorService = ServiceManager.getService(project, EditorService::class.java)
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