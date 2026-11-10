package com.talkreadyai.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MicrophonePermissionPlugin.class);
        registerPlugin(NativeSpeechRecognitionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}