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
