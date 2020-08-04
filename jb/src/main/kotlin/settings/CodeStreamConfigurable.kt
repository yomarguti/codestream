package com.codestream.settings

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.options.SearchableConfigurable
import javax.swing.JComponent

class CodeStreamConfigurable : SearchableConfigurable {
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
        val settingsService = ServiceManager.getService(ApplicationSettingsService::class.java)
        val state = settingsService.state
        val gui = _gui
        gui?.let {
            state.autoSignIn = gui.autoSignIn.isSelected
            state.serverUrl = if (gui.serverUrl.text.isNullOrEmpty()) gui.serverUrl.text else gui.serverUrl.text.trimEnd('/')
            state.disableStrictSSL = gui.disableStrictSSL.isSelected
            state.avatars = gui.showAvatars.isSelected
            state.team = gui.team.text
            state.showFeedbackSmiley = gui.showFeedbackSmiley.isSelected
            state.showMarkers = gui.showMarkers.isSelected
            state.autoHideMarkers = gui.autoHideMarkers.isSelected
            state.proxySupport = gui.proxySupport.selectedItem as ProxySupport
            state.proxyStrictSSL = gui.proxyStrictSSL.isSelected
            state.jcef = gui.jcef.isSelected
        }
    }

    override fun createComponent(): JComponent? {
        val gui = CodeStreamConfigurableGUI()
        val settingsService = ServiceManager.getService(ApplicationSettingsService::class.java)
        val state = settingsService.state

        state.let {
            gui.apply {
                autoSignIn.isSelected = it.autoSignIn
                serverUrl.text = it.serverUrl
                disableStrictSSL.isSelected = it.disableStrictSSL
                showAvatars.isSelected = it.avatars
                team.text = it.team
                showFeedbackSmiley.isSelected = it.showFeedbackSmiley
                showMarkers.isSelected = it.showMarkers
                autoHideMarkers.isSelected = it.autoHideMarkers
                proxySupport.selectedItem = it.proxySupport
                proxyStrictSSL.isSelected = it.proxyStrictSSL
                jcef.isSelected = it.jcef
            }
        }

        _gui = gui
        return gui.rootPanel
    }
}
