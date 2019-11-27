package com.codestream.settings;

import javax.swing.*;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.awt.event.ItemEvent;

import static com.codestream.settings.ApplicationSettingsServiceKt.API_PROD;

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

        serverUrl.getDocument().addDocumentListener(new DocumentListener() {
            @Override
            public void insertUpdate(DocumentEvent e) {
                validateServerUrl(serverUrl.getText());
            }

            @Override
            public void removeUpdate(DocumentEvent e) {
                validateServerUrl(serverUrl.getText());
            }

            @Override
            public void changedUpdate(DocumentEvent e) {
                validateServerUrl(serverUrl.getText());
            }
        });

        validateServerUrl(serverUrl.getText());
    }

    private void validateServerUrl(String text) {
        if (text.equals(API_PROD)) {
            disableStrictSSL.setSelected(false);
            disableStrictSSL.setEnabled(false);
        } else {
            disableStrictSSL.setEnabled(true);
        }
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
