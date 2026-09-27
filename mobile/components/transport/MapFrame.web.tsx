import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { liveMapHtml, type LiveMapCommand } from './liveMapHtml';

export interface MapFrameHandle {
    send: (command: LiveMapCommand) => void;
}

/** The Leaflet map page in an iframe, for the web build (react-native-webview has no web support). */
export const MapFrame = forwardRef<MapFrameHandle, { onReady: () => void }>(function MapFrame({ onReady }, ref) {
    const frame = useRef<HTMLIFrameElement>(null);
    const html = useMemo(liveMapHtml, []);
    useImperativeHandle(ref, () => ({
        send: (command) => frame.current?.contentWindow?.postMessage(command, '*'),
    }), []);
    useEffect(() => {
        const listen = (e: MessageEvent) => {
            if (e.source === frame.current?.contentWindow && e.data === 'live-map-ready') onReady();
        };
        window.addEventListener('message', listen);
        return () => window.removeEventListener('message', listen);
    }, [onReady]);
    return (
        <iframe
            ref={frame}
            title="Live bus map"
            srcDoc={html}
            sandbox="allow-scripts"
            style={{ width: '100%', height: 360, border: '1px solid #e2e8f0', borderRadius: 16, marginBottom: 12 }}
        />
    );
});
