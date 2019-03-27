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
}
