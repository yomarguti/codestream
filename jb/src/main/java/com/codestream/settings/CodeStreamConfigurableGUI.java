package com.codestream.settings;

import javax.swing.*;

public class CodeStreamConfigurableGUI {
    private JPanel rootPanel;
    private JCheckBox autoSignIn;
    private JTextField serverUrl;
    private JTextField webAppUrl;
    private JCheckBox showAvatars;
    private JCheckBox muteAll;
    private JTextField team;
    private JCheckBox showFeedbackSmiley;
    private JCheckBox autoHideMarkers;
    private JCheckBox showMarkers;
    private JTextField proxyUrl;
    private JComboBox proxySupport;
    private JCheckBox proxyStrictSSL;

    public JPanel getRootPanel() {
        return rootPanel;
    }

    public JCheckBox getAutoSignIn() {
        return autoSignIn;
    }

    public JTextField getServerUrl() {
        return serverUrl;
    }

    public JTextField getWebAppUrl() {
        return webAppUrl;
    }

    public JCheckBox getShowAvatars() {
        return showAvatars;
    }

    public JCheckBox getMuteAll() {
        return muteAll;
    }

    public JTextField getTeam() {
        return team;
    }

    public JCheckBox getShowFeedbackSmiley() {
        return showFeedbackSmiley;
    }

    public JCheckBox getAutoHideMarkers() {
        return autoHideMarkers;
    }

    public JCheckBox getShowMarkers() {
        return showMarkers;
    }

    public JTextField getProxyUrl() {
        return proxyUrl;
    }

    public JComboBox<String> getProxySupport() {
        return proxySupport;
    }

    public JCheckBox getProxyStrictSSL() {
        return proxyStrictSSL;
    }
}
