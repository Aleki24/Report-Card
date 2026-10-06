import { Alert } from 'react-native';

/** Formats an error with the top of its stack, short enough for an alert. */
export function describeError(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    const stack = (error.stack ?? '').split('\n').slice(1, 6).join('\n');
    return `${error.name}: ${error.message}${stack ? `\n\n${stack}` : ''}`;
}

/**
 * Release builds close outright on a fatal JS error, leaving only "keeps
 * stopping". Show the error instead so it can be read off the screen; render
 * errors are caught by the root layout's ErrorBoundary.
 */
export function installFatalErrorAlert(): void {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        if (!isFatal) {
            previous(error, isFatal);
            return;
        }
        Alert.alert('Skulbase hit an error', describeError(error));
    });
}
