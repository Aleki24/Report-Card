import React, { useEffect, useRef, useState } from 'react';
import { useSignOut } from '@/lib/useSignOut';
import { DateField } from './DateField';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { extractInviteCode, INVITE_CODE_LENGTH } from '@shared/activation-link';
import { CURRICULA, ONBOARDING_TERMS } from '@shared/schemas';
import {
    CURRICULUM_OPTIONS, ONBOARDING_STEPS, chosenGrades, initialOnboarding, onboardingPayload, onboardingStepProblem,
    type OnboardingState, type StandardGrade,
} from '@shared/onboarding/plan';
import { Button, ButtonRow, Card, ChipSelect, ErrorBanner, LoadingView, Notice, ProgressBar, TextField, ToggleRow } from './ui';
import { useToast } from './Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useCurrentUser } from '@/lib/UserContext';
import { takePendingInviteCode } from '@/lib/pendingInvite';
import { spacing, fonts, makeStyles } from '@/lib/theme';

interface Approval { hasSchool?: boolean; status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | null; schoolName?: string | null; note?: string | null }
type Mode = 'choose' | 'school' | 'join';

/**
 * For an account with no school yet — the web's onboarding: set a new
 * school up (sent to the platform team for approval) or join one with an
 * invite code. An admin whose school setup is unfinished lands here too.
 */
export function Onboarding() {
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const { signOut, signingOut } = useSignOut();
    const { baseRole, reload } = useCurrentUser();
    const [approval, setApproval] = useState<Approval | null>(null);
    const [checked, setChecked] = useState(false);
    // A code verified on the activation screen before choosing Google.
    const [handedOff] = useState(takePendingInviteCode);
    const [mode, setMode] = useState<Mode>(handedOff ? 'join' : baseRole === 'ADMIN' ? 'school' : 'choose');
    const [step, setStep] = useState(1);
    const [state, setState] = useState<OnboardingState>(initialOnboarding);
    const [grades, setGrades] = useState<StandardGrade[]>([]);
    const [code, setCode] = useState(handedOff ?? '');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get<Approval>('/api/school/approval-status')
            .then((d) => { if (d.hasSchool) setApproval(d); })
            .catch(() => undefined)
            .finally(() => setChecked(true));
    }, [api]);

    useEffect(() => {
        if (mode !== 'school' || grades.length > 0) return;
        api.get<{ grades: StandardGrade[] }>('/api/school/onboarding')
            .then((d) => setGrades(d.grades))
            .catch((err: unknown) => toast.error(errorMessage(err, 'Could not load the grade list')));
    }, [api, mode, grades.length, toast]);

    const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) => setState((s) => ({ ...s, [k]: v }));

    const next = async () => {
        const problem = onboardingStepProblem(step, state, grades);
        if (problem) { toast.error(problem); return; }
        if (step < ONBOARDING_STEPS.length) { setStep(step + 1); return; }
        setBusy(true);
        try {
            const r = await api.post<{ awaitingApproval?: boolean }>('/api/school/onboarding', onboardingPayload(state, grades));
            toast.success(r.awaitingApproval ? 'Request sent. We will let you know when it is approved.' : 'Your school is ready.');
            reload();
            if (r.awaitingApproval) setApproval({ hasSchool: true, status: 'PENDING_APPROVAL', schoolName: state.schoolName });
        } catch (err) {
            toast.error(errorMessage(err, 'Something went wrong'));
        } finally {
            setBusy(false);
        }
    };

    const join = async (inviteCode: string = code) => {
        if (inviteCode.length !== INVITE_CODE_LENGTH) { toast.error(`Enter the ${INVITE_CODE_LENGTH}-character invite code from your school`); return; }
        setBusy(true);
        try {
            await api.post('/api/school/join', { inviteCode });
            toast.success('Successfully joined the school!');
            reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Failed to join school'));
        } finally {
            setBusy(false);
        }
    };

    // Finish a Google activation straight away, as the web's /activate/callback does.
    const joinedHandOff = useRef(false);
    useEffect(() => {
        if (!handedOff || joinedHandOff.current) return;
        joinedHandOff.current = true;
        void join(handedOff);
        // Runs once on arrival with the handed-off code.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handedOff]);

    const frame = (body: React.ReactNode) => (
        <SafeAreaView style={styles.safe}>
            <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={spacing.xl}>
                <View style={styles.content}>
                    {body}
                    <View style={{ marginTop: spacing.lg }}><Button variant="ghost" label={signingOut ? 'Signing out…' : 'Sign out'} loading={signingOut} onPress={() => void signOut()} /></View>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );

    if (!checked) return <LoadingView />;

    if (approval?.status === 'PENDING_APPROVAL' || approval?.status === 'REJECTED') {
        const waiting = approval.status === 'PENDING_APPROVAL';
        return frame(
            <Card>
                <Text style={styles.title}>{waiting ? '⏳ Waiting for approval' : 'Request not approved'}</Text>
                <Text style={styles.body}>
                    {waiting
                        ? `Your request to set up ${approval.schoolName || 'your school'} has been sent to the Skulbase team. We'll email you as soon as it's reviewed — your account unlocks the moment it's approved.`
                        : `We couldn't approve the request for ${approval.schoolName || 'your school'}.`}
                </Text>
                {!waiting && approval.note ? <Notice tone="info" message={approval.note} /> : null}
                <Text style={styles.muted}>Joining a school that already uses Skulbase? Ask your administrator for an invite code — you won't need this request.</Text>
                <ButtonRow>
                    {waiting ? <Button variant="secondary" label="Check again" onPress={reload} /> : null}
                    <Button label="I have an invite code" onPress={() => { setApproval(null); setMode('join'); }} />
                </ButtonRow>
            </Card>,
        );
    }

    if (mode === 'choose') {
        return frame(
            <>
                <Text style={styles.title}>Welcome to Skulbase</Text>
                <Text style={styles.body}>How are you joining?</Text>
                <Card style={styles.choice}>
                    <Text style={styles.choiceTitle}>I'm setting up my school</Text>
                    <Text style={styles.muted}>For the principal or administrator: school details, calendar, curriculum, classes and subjects.</Text>
                    <Button label="Set up a school" onPress={() => setMode('school')} />
                </Card>
                <Card style={styles.choice}>
                    <Text style={styles.choiceTitle}>My school already uses Skulbase</Text>
                    <Text style={styles.muted}>Teachers, staff, students and parents: join with the invite code your school gave you.</Text>
                    <Button variant="secondary" label="Join with a code" onPress={() => setMode('join')} />
                </Card>
            </>,
        );
    }

    if (mode === 'join') {
        return frame(
            <Card>
                <Text style={styles.title}>Join your school</Text>
                <Text style={styles.body}>Enter the {INVITE_CODE_LENGTH}-character invite code from your school.</Text>
                <TextField label="Invite code" value={code} onChangeText={(v) => setCode(extractInviteCode(v))} autoCapitalize="characters" placeholder="A7X3K9" />
                <ButtonRow>
                    <Button variant="secondary" label="Back" onPress={() => setMode('choose')} />
                    <Button label="Join" loading={busy} onPress={() => void join()} />
                </ButtonRow>
            </Card>,
        );
    }

    const current = ONBOARDING_STEPS[step - 1];
    const ticked = chosenGrades(state, grades);
    const stepProblem = onboardingStepProblem(step, state, grades);
    return frame(
        <>
            <Text style={styles.muted}>Step {step} of {ONBOARDING_STEPS.length}</Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.description}</Text>
            <ProgressBar value={(step / ONBOARDING_STEPS.length) * 100} />
            <Card style={{ marginTop: spacing.md }}>
                {step === 1 ? (
                    <>
                        <TextField label="School name *" value={state.schoolName} onChangeText={(v) => set('schoolName', v)} />
                        <TextField label="Email" value={state.schoolEmail} onChangeText={(v) => set('schoolEmail', v)} keyboardType="email-address" autoCapitalize="none" />
                        <TextField label="Phone" value={state.schoolPhone} onChangeText={(v) => set('schoolPhone', v)} keyboardType="phone-pad" />
                        <TextField label="Address" value={state.schoolAddress} onChangeText={(v) => set('schoolAddress', v)} multiline />
                    </>
                ) : null}
                {step === 2 ? (
                    <>
                        <TextField label="Academic year *" value={state.academicYear} onChangeText={(v) => set('academicYear', v)} keyboardType="number-pad" />
                        <ChipSelect label="Current term" options={ONBOARDING_TERMS.map((t) => ({ value: t, label: t }))} value={state.term.name} onChange={(name) => set('term', { ...state.term, name })} />
                        <DateField label="Term starts *" value={state.term.start_date} onChange={(v) => set('term', { ...state.term, start_date: v })} />
                        <DateField label="Term ends *" value={state.term.end_date} min={state.term.start_date || undefined} onChange={(v) => set('term', { ...state.term, end_date: v })} />
                    </>
                ) : null}
                {step === 3 ? CURRICULA.map((c) => (
                    <ToggleRow
                        key={c}
                        label={CURRICULUM_OPTIONS[c].label}
                        description={CURRICULUM_OPTIONS[c].description}
                        value={state.curricula.includes(c)}
                        onValueChange={(on) => set('curricula', on ? [...state.curricula, c] : state.curricula.filter((x) => x !== c))}
                    />
                )) : null}
                {step === 4 ? (
                    grades.length === 0 ? <LoadingView /> : grades.filter((g) => state.curricula.includes(g.curriculum)).map((g) => {
                        const plan = state.classPlans[g.id];
                        return (
                            <View key={g.id} style={styles.grade}>
                                <ToggleRow
                                    label={g.name}
                                    value={!!plan}
                                    onValueChange={(on) => {
                                        const plans = { ...state.classPlans };
                                        if (on) plans[g.id] = { hasStreams: false, streams: '' }; else delete plans[g.id];
                                        set('classPlans', plans);
                                    }}
                                />
                                {plan ? (
                                    <>
                                        <ChipSelect options={[{ value: 'one', label: 'One class' }, { value: 'streams', label: 'Streams' }]} value={plan.hasStreams ? 'streams' : 'one'}
                                            onChange={(v) => set('classPlans', { ...state.classPlans, [g.id]: { ...plan, hasStreams: v === 'streams' } })} />
                                        {plan.hasStreams ? (
                                            <TextField label="Stream names, comma-separated" value={plan.streams} placeholder="East, West, North"
                                                onChangeText={(v) => set('classPlans', { ...state.classPlans, [g.id]: { ...plan, streams: v } })} />
                                        ) : null}
                                    </>
                                ) : null}
                            </View>
                        );
                    })
                ) : null}
                {step === 5 ? (
                    <>
                        <Text style={styles.muted}>Exams and mark sheets need subjects. Start with the ones every learner takes; add electives and optional subjects on the Subjects screen once you're in.</Text>
                        <ToggleRow
                            label="Add the compulsory subjects for my classes (recommended)"
                            description="From the standard Kenyan curriculum list, with their official codes."
                            value={state.offerSubjects}
                            onValueChange={(v) => set('offerSubjects', v)}
                        />
                        <Text style={styles.muted}>{ticked.length} grade{ticked.length === 1 ? '' : 's'} chosen.</Text>
                    </>
                ) : null}
            </Card>
            {step === 4 && ticked.length > 0 && stepProblem ? <ErrorBanner message={stepProblem} /> : null}
            <ButtonRow>
                <Button variant="secondary" label="Back" onPress={() => (step > 1 ? setStep(step - 1) : setMode('choose'))} />
                <Button label={step < ONBOARDING_STEPS.length ? 'Continue' : 'Finish setup'} loading={busy} onPress={() => void next()} />
            </ButtonRow>
        </>,
    );
}

const useStyles = makeStyles((colors) => ({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.foreground, marginBottom: spacing.xs },
    body: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: spacing.md },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginVertical: spacing.sm },
    choice: { marginBottom: spacing.md, gap: spacing.sm },
    choiceTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    grade: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm },
}));
