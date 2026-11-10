package com.talkreadyai.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name = "NativeSpeechRecognition")
public class NativeSpeechRecognitionPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean listening = false;
    private boolean destroyed = false;
    private String language = "en-IN";

    @PluginMethod
    public void startListening(PluginCall call) {
        String requestedLanguage = call.getString("language", "en-IN");
        language = requestedLanguage == null || requestedLanguage.trim().isEmpty() ? "en-IN" : requestedLanguage;
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is not available on this Android device. Install or enable a speech recognition service.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                destroyed = false;
                listening = true;
                if (recognizer != null) {
                    try { recognizer.destroy(); } catch (Exception ignored) {}
                }
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(this);
                startRecognizerSession();
                call.resolve();
            } catch (Exception error) {
                listening = false;
                call.reject("Could not start Android speech recognition: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    private void startRecognizerSession() {
        if (!listening || destroyed || recognizer == null) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
        intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 650L);
        try { recognizer.startListening(intent); }
        catch (Exception error) { emitError("Unable to start recognition: " + error.getMessage(), -1); scheduleRestart(700); }
    }

    private void scheduleRestart(long delayMs) {
        handler.postDelayed(() -> {
            if (listening && !destroyed && recognizer != null) startRecognizerSession();
        }, delayMs);
    }

    private void emitResult(String text, boolean isFinal) {
        if (text == null || text.trim().isEmpty()) return;
        JSObject payload = new JSObject();
        payload.put("transcript", text.trim());
        payload.put("isFinal", isFinal);
        notifyListeners("speechResult", payload);
    }

    private void emitError(String message, int code) {
        JSObject payload = new JSObject();
        payload.put("message", message);
        payload.put("code", code);
        notifyListeners("speechError", payload);
    }

    private void stopInternal() {
        listening = false;
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) {}
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}

    @Override
    public void onError(int error) {
        if (!listening || destroyed) return;
        // Silence/no-match are normal between short utterances; keep listening.
        if (error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            String message = "Android speech recognition error (" + error + ").";
            emitError(message, error);
        }
        scheduleRestart(error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 900 : 350);
    }

    @Override
    public void onResults(Bundle results) {
        if (!listening || destroyed) return;
        ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) emitResult(matches.get(0), true);
        scheduleRestart(250);
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        if (!listening || destroyed) return;
        ArrayList<String> matches = partialResults == null ? null : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) emitResult(matches.get(0), false);
    }

    @Override public void onEvent(int eventType, Bundle params) {}

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        stopInternal();
        super.handleOnDestroy();
    }
}