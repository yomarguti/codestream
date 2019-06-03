package com.codestream.settings

import com.codestream.settingsService
import com.intellij.openapi.options.SearchableConfigurable
import com.intellij.openapi.project.Project
import javax.swing.JComponent

class CodeStreamConfigurable(val project: Project) : SearchableConfigurable {
    private var _gui: CodeStreamConfigurableGUI? = null

    override fun isModified(): Boolean {
        return true
    }

    override fun getId(): String {
        return "preferences.CodeStreamConfigurable"
    }

    override fun getDisplayName(): String {
        return "CodeStream"
    }

    override fun apply() {
        val state = project.settingsService?.state ?: return
        val gui = _gui
        gui?.let {
            state.autoSignIn = gui.autoSignIn.isSelected
            state.serverUrl = gui.serverUrl.text
            state.avatars = gui.showAvatars.isSelected
            state.notifications = gui.showNotifications.selectedItem as String?
            state.muteAll = gui.muteAll.isSelected
            state.team = gui.team.text
            state.showFeedbackSmiley = gui.showFeedbackSmiley.isSelected
            state.showMarkers = gui.showMarkers.isSelected
            state.autoHideMarkers = gui.autoHideMarkers.isSelected
            state.proxySupport = gui.proxySupport.selectedItem as String
            state.proxyStrictSSL = gui.proxyStrictSSL.isSelected
            state.proxyUrl = gui.proxyUrl.text
        }
    }

    override fun createComponent(): JComponent? {
        val gui = CodeStreamConfigurableGUI()

        project.settingsService?.state?.let {
            gui.apply {
                autoSignIn.isSelected = it.autoSignIn
                serverUrl.text = it.serverUrl
                showAvatars.isSelected = it.avatars
                showNotifications.selectedItem = it.notifications
                muteAll.isSelected = it.muteAll
                team.text = it.team
                showFeedbackSmiley.isSelected = it.showFeedbackSmiley
                showMarkers.isSelected = it.showMarkers
                autoHideMarkers.isSelected = it.autoHideMarkers
                proxySupport.selectedItem = it.proxySupport
                proxyStrictSSL.isSelected = it.proxyStrictSSL
                proxyUrl.text = it.proxyUrl
            }
        }

        _gui = gui
        return gui.rootPanel
    }
}
