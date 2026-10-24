package com.arogyakunj.wellness;

import android.Manifest;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.os.Process;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "NativeLiveAudio",
    permissions = {
        @Permission(
            strings = { Manifest.permission.RECORD_AUDIO },
            alias = "microphone"
        )
    }
)
public class NativeLiveAudioPlugin extends Plugin {
    private static final String TAG = "NativeLiveAudio";

    // Gemini Multimodal Live Protocol:
    // Input: 16kHz, 16-bit Mono PCM
    // Output: 24kHz, 16-bit Mono PCM
    private static final int INPUT_SAMPLE_RATE = 16000;
    private static final int OUTPUT_SAMPLE_RATE = 24000;
    private static final int CHUNK_SIZE_BYTES = 1024; // ~32ms per audio chunk

    private AudioRecord audioRecord;
    private AudioTrack audioTrack;
    private AcousticEchoCanceler echoCanceler;
    private NoiseSuppressor noiseSuppressor;

    private final AtomicBoolean isRecording = new AtomicBoolean(false);
    private ExecutorService recordExecutor;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("hardwareAecSupported", AcousticEchoCanceler.isAvailable());
        call.resolve(ret);
    }

    @PluginMethod
    public void startCapture(PluginCall call) {
        if (isRecording.get()) {
            call.resolve();
            return;
        }

        try {
            int minBufferSize = AudioRecord.getMinBufferSize(
                INPUT_SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            int bufferSize = Math.max(minBufferSize, CHUNK_SIZE_BYTES * 4);

            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                INPUT_SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                call.reject("AudioRecord initialization failed");
                return;
            }

            int sessionId = audioRecord.getAudioSessionId();

            // Activate Hardware Acoustic Echo Cancellation on DSP
            if (AcousticEchoCanceler.isAvailable()) {
                try {
                    echoCanceler = AcousticEchoCanceler.create(sessionId);
                    if (echoCanceler != null) {
                        echoCanceler.setEnabled(true);
                        Log.i(TAG, "Hardware AcousticEchoCanceler enabled on session " + sessionId);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not attach AcousticEchoCanceler: " + e.getMessage());
                }
            }

            // Activate Hardware Noise Suppression
            if (NoiseSuppressor.isAvailable()) {
                try {
                    noiseSuppressor = NoiseSuppressor.create(sessionId);
                    if (noiseSuppressor != null) {
                        noiseSuppressor.setEnabled(true);
                        Log.i(TAG, "Hardware NoiseSuppressor enabled on session " + sessionId);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not attach NoiseSuppressor: " + e.getMessage());
                }
            }

            audioRecord.startRecording();
            isRecording.set(true);

            recordExecutor = Executors.newSingleThreadExecutor();
            recordExecutor.execute(() -> {
                Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
                byte[] audioBuffer = new byte[CHUNK_SIZE_BYTES];

                while (isRecording.get() && audioRecord != null) {
                    int bytesRead = audioRecord.read(audioBuffer, 0, audioBuffer.length);
                    if (bytesRead > 0) {
                        // Calculate volume level (RMS) for UI feedback
                        long sum = 0;
                        int samples = bytesRead / 2;
                        for (int i = 0; i < samples; i++) {
                            short sample = (short) ((audioBuffer[i * 2 + 1] << 8) | (audioBuffer[i * 2] & 0xFF));
                            sum += (long) sample * sample;
                        }
                        double rms = Math.sqrt((double) sum / samples);
                        int volumeLevel = Math.min(100, (int) (rms / 327.67));

                        String base64Data = Base64.encodeToString(audioBuffer, 0, bytesRead, Base64.NO_WRAP);

                        JSObject event = new JSObject();
                        event.put("data", base64Data);
                        event.put("volume", volumeLevel);
                        notifyListeners("nativeAudioChunk", event);
                    }
                }
            });

            call.resolve();
        } catch (SecurityException se) {
            call.reject("Permission denied to record audio", se);
        } catch (Exception e) {
            call.reject("Error starting native audio capture: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        isRecording.set(false);

        if (recordExecutor != null) {
            recordExecutor.shutdown();
            recordExecutor = null;
        }

        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.w(TAG, "Error stopping audioRecord: " + e.getMessage());
            }
            audioRecord = null;
        }

        if (echoCanceler != null) {
            try {
                echoCanceler.release();
            } catch (Exception ignored) {}
            echoCanceler = null;
        }

        if (noiseSuppressor != null) {
            try {
                noiseSuppressor.release();
            } catch (Exception ignored) {}
            noiseSuppressor = null;
        }

        call.resolve();
    }

    private synchronized void ensureAudioTrack() {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_NORMAL);
                audioManager.setSpeakerphoneOn(true);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error setting audio mode: " + e.getMessage());
        }

        if (audioTrack == null || audioTrack.getState() != AudioTrack.STATE_INITIALIZED) {
            int minBufferSize = AudioTrack.getMinBufferSize(
                OUTPUT_SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            int bufferSize = Math.max(minBufferSize, 4096);

            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();

            AudioFormat format = new AudioFormat.Builder()
                .setSampleRate(OUTPUT_SAMPLE_RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();

            audioTrack = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();

            audioTrack.play();
        } else if (audioTrack.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) {
            audioTrack.play();
        }
    }

    @PluginMethod
    public void playAudioChunk(PluginCall call) {
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.resolve();
            return;
        }

        try {
            byte[] pcmBytes = Base64.decode(base64Data, Base64.NO_WRAP);
            ensureAudioTrack();

            if (audioTrack != null) {
                audioTrack.write(pcmBytes, 0, pcmBytes.length);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error writing audio chunk to AudioTrack: " + e.getMessage());
            call.reject("Error playing native audio chunk: " + e.getMessage());
        }
    }

    @PluginMethod
    public void interruptPlayback(PluginCall call) {
        try {
            if (audioTrack != null) {
                // Instant hardware barge-in: pause and flush ring buffer
                audioTrack.pause();
                audioTrack.flush();
                audioTrack.play();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error interrupting playback: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        try {
            if (audioTrack != null) {
                audioTrack.pause();
                audioTrack.flush();
                audioTrack.stop();
                audioTrack.release();
                audioTrack = null;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error stopping audioTrack: " + e.getMessage());
        }
    }

    private TextToSpeech ttsEngine;

    private synchronized void initTtsIfNeeded() {
        if (ttsEngine == null) {
            ttsEngine = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS && ttsEngine != null) {
                    int result = ttsEngine.setLanguage(new Locale("mr", "IN"));
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        ttsEngine.setLanguage(new Locale("hi", "IN"));
                    }
                    ttsEngine.setSpeechRate(0.95f);
                    ttsEngine.setPitch(1.15f);
                }
            });
        }
    }

    @PluginMethod
    public void speakTextNative(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }

        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_NORMAL);
                audioManager.setSpeakerphoneOn(true);
            }

            String cleanText = text
                .replaceAll("[#*_`~>•-]", " ")
                .replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1")
                .replaceAll("\\s+", " ")
                .trim();

            initTtsIfNeeded();

            if (ttsEngine != null) {
                if (ttsEngine.isSpeaking()) {
                    ttsEngine.stop();
                }
                ttsEngine.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, "ArogyakunjNativeTTS");
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error in speakTextNative: " + e.getMessage());
            call.reject("Error speaking native text: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopTextNative(PluginCall call) {
        try {
            if (ttsEngine != null && ttsEngine.isSpeaking()) {
                ttsEngine.stop();
            }
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        isRecording.set(false);
        if (recordExecutor != null) {
            recordExecutor.shutdown();
        }
        if (audioRecord != null) {
            try { audioRecord.release(); } catch (Exception ignored) {}
            audioRecord = null;
        }
        if (audioTrack != null) {
            try { audioTrack.release(); } catch (Exception ignored) {}
            audioTrack = null;
        }
    }
}
