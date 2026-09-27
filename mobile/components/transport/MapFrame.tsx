import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/lib/theme';
import { liveMapHtml, type LiveMapCommand } from './liveMapHtml';

export interface MapFrameHandle {
    send: (command: LiveMapCommand) => void;
}

/** The Leaflet map page in a native WebView (the web build uses `MapFrame.web.tsx`). */
export const MapFrame = forwardRef<MapFrameHandle, { onReady: () => void }>(function MapFrame({ onReady }, ref) {
    const webview = useRef<WebView>(null);
    const html = useMemo(liveMapHtml, []);
    useImperativeHandle(ref, () => ({
        send: (command) => {
            const call = command.type === 'render'
                ? `window.render(${JSON.stringify(command.trips)});`
                : `window.focusBus(${command.lat}, ${command.lng});`;
            webview.current?.injectJavaScript(`${call} true;`);
        },
    }), []);
    return (
        <View style={styles.frame}>
            <WebView
                ref={webview}
                originWhitelist={['*']}
                source={{ html }}
                onMessage={(e) => { if (e.nativeEvent.data === 'ready') onReady(); }}
                javaScriptEnabled
                setSupportMultipleWindows={false}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    frame: { height: 360, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
});
