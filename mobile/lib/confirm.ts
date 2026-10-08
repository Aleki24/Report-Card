import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * `Alert.alert` with the same arguments, but working on the web build too.
 *
 * react-native-web's Alert does nothing, so on the deployed web app every
 * "Delete? / Withdraw? / Void?" button silently did nothing. There the
 * browser's own confirm dialog asks instead, and the first non-cancel button
 * runs if the user agrees.
 */
export function confirmAlert(title: string, message: string, buttons: AlertButton[]): void {
    if (Platform.OS !== 'web') {
        Alert.alert(title, message, buttons);
        return;
    }
    const action = buttons.find((b) => b.style !== 'cancel');
    if (action && window.confirm(`${title}\n\n${message}`)) action.onPress?.();
}

/**
 * Asks a yes/no question and resolves true only when the user picks
 * `action`; Cancel, or dismissing the dialog (Android back), resolves false.
 */
export function askConfirm(title: string, message: string, action: string): Promise<boolean> {
    if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: action, onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
        );
    });
}
