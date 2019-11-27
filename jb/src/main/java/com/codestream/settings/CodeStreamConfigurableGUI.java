package com.codestream.settings;

import javax.swing.*;
import java.awt.event.ItemEvent;

public class CodeStreamConfigurableGUI {
    private JPanel rootPanel;
    private JCheckBox autoSignIn;
    private JTextField serverUrl;
    private JCheckBox disableStrictSSL;
    private JCheckBox showAvatars;
    private JTextField team;
    private JCheckBox showFeedbackSmiley;
    private JCheckBox autoHideMarkers;
    private JCheckBox showMarkers;
    private JTextField proxyUrl;
    private JComboBox proxySupport;
    private JCheckBox proxyStrictSSL;
    private JComboBox showNotifications;

    public CodeStreamConfigurableGUI() {
        proxySupport.addItemListener(event -> {
            if (event.getStateChange() == ItemEvent.SELECTED) {
                Object item = event.getItem();
                proxyUrl.setEnabled(item.equals("override"));
                proxyStrictSSL.setEnabled(item.equals("override") || item.equals("on"));
            }
        });
    }

    public JPanel getRootPanel() {
        return rootPanel;
    }

    public JCheckBox getAutoSignIn() {
        return autoSignIn;
    }

    public JTextField getServerUrl() {
        return serverUrl;
    }

    public JCheckBox getDisableStrictSSL() {
        return disableStrictSSL;
    }

    public JCheckBox getShowAvatars() {
        return showAvatars;
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

    public JComboBox<String> getShowNotifications() { return showNotifications; }

    public JCheckBox getProxyStrictSSL() {
        return proxyStrictSSL;
    }
}
