import React, { useState } from 'react';
import { Text } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { fonts } from '@/lib/theme';
import { describeCodeError, type PendingCodeVerification } from '@/lib/useSignInCodeVerification';
import { AuthError, AuthField, AuthFootnote, AuthLink, AuthPrimaryButton, AuthStack } from './AuthShell';

const CODE_LENGTH = 6;

interface VerificationCodeStepProps {
    pending: PendingCodeVerification;
    /** Seconds until another code may be requested. */
    cooldown: number;
    onVerify: (code: string) => Promise<boolean>;
    onResend: () => Promise<void>;
    onBack: () => void;
}

/**
 * Clerk's new-device check: enter the emailed or texted code. Shared by
 * sign-in and sign-up, as the web's VerificationCodeStep. Signing in
 * completes the session, which moves the app on by itself.
 */
export function VerificationCodeStep({ pending, cooldown, onVerify, onResend, onBack }: VerificationCodeStepProps) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const verify = async () => {
        setError(null);
        setNotice(null);
        setBusy(true);
        try {
            if (!(await onVerify(code))) setError('Verification could not be completed. Request a new code and try again.');
        } catch (err) {
            setError(describeCodeError(err));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        setError(null);
        setNotice(null);
        try {
            await onResend();
            setCode('');
            setNotice('A new code is on its way.');
        } catch (err) {
            setError(describeCodeError(err));
        }
    };

    return (
        <AuthStack>
            <AuthError message={error} />
            <AuthFootnote>
                We sent a {CODE_LENGTH}-digit code to your {pending.strategy === 'email_code' ? 'email' : 'phone'},{' '}
                <Text style={{ fontFamily: fonts.semibold }}>{pending.safeIdentifier}</Text>.
            </AuthFootnote>
            <AuthField
                label="Verification code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                autoFocus
                placeholder="123456"
                hint={notice ?? undefined}
            />
            <AuthPrimaryButton label="Verify and continue" icon={ShieldCheck} onPress={() => void verify()} loading={busy} disabled={code.length !== CODE_LENGTH} />
            <AuthFootnote>
                <AuthLink label="Back" onPress={onBack} />
                {'   ·   '}
                {cooldown > 0 ? `Resend code in ${cooldown}s` : <AuthLink label="Resend code" onPress={() => void resend()} />}
            </AuthFootnote>
        </AuthStack>
    );
}
