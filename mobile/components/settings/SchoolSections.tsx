import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { CurriculumBand } from '@shared/curriculum-bands';
import {
    SCHOOL_SECTIONS_URL, bandLabel, sectionForBand, sectionSignatureTarget,
    type SchoolSection, type SchoolSectionInput, type SchoolSectionsOverview,
} from '@shared/school-sections';
import { Button, ButtonRow, Card, ErrorBanner, LoadingView, Notice, SectionLabel, TextField, ToggleRow } from '@/components/ui';
import { SignatureCard } from '@/components/account/SignatureCard';
import { useApi } from '@/lib/api';
import { askConfirm } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { fonts, makeStyles, spacing } from '@/lib/theme';
import { useApiQuery } from '@/lib/useApiQuery';

type Msg = { tone: 'success' | 'danger'; text: string } | null;

const listBands = (bands: readonly CurriculumBand[]) => bands.map(bandLabel).join(', ') || 'No classes yet';

/**
 * The school's sections (Primary, Junior School, Senior School), each with
 * its own head who signs its classes' report cards and mark sheets. A
 * school with one admin and several principals sets them up here.
 */
export function SchoolSections() {
    const styles = useStyles();
    const api = useApi();
    const query = useApiQuery<SchoolSectionsOverview>(SCHOOL_SECTIONS_URL);
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<Msg>(null);

    const sections = query.data?.sections ?? [];
    const bands = query.data?.bands ?? [];
    const unplaced = bands.filter((b) => !sectionForBand(sections, b.band));

    const run = async (work: () => Promise<unknown>, done: string) => {
        setBusy(true);
        setMessage(null);
        try {
            await work();
            setMessage({ tone: 'success', text: done });
            setEditing(null);
            query.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not save the section.') });
        } finally {
            setBusy(false);
        }
    };

    if (query.loading && !query.data) return <LoadingView />;

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <SectionLabel>Sections and their heads</SectionLabel>
                <Text style={styles.note}>
                    Each section’s head signs its own classes’ report cards and mark sheets. Classes in no section are signed by the principal above.
                </Text>
                {query.error ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
                {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
                {sections.length === 0 ? (
                    <ButtonRow>
                        <Button
                            label="Set up Primary, Junior and Senior"
                            loading={busy}
                            onPress={() => void run(() => api.post(SCHOOL_SECTIONS_URL, { defaults: true }), 'Sections set up. Add each head’s name and signature below.')}
                        />
                        <Button variant="secondary" label="Add a section" onPress={() => setEditing('new')} disabled={busy} />
                    </ButtonRow>
                ) : (
                    <ButtonRow>
                        <Button size="sm" variant="secondary" label="+ Add a section" onPress={() => setEditing('new')} disabled={busy} />
                    </ButtonRow>
                )}
                {unplaced.length > 0 && sections.length > 0 ? (
                    <Text style={styles.note}>Not in a section: {unplaced.map((b) => b.label).join(', ')}.</Text>
                ) : null}
            </Card>

            {editing === 'new' ? (
                <SectionEditor
                    sections={sections}
                    bands={bands.map((b) => b.band)}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={(input) => void run(() => api.post(SCHOOL_SECTIONS_URL, input), `${input.name} added.`)}
                />
            ) : null}

            {sections.map((section) => (
                <View key={section.id}>
                    {editing === section.id ? (
                        <SectionEditor
                            section={section}
                            sections={sections}
                            bands={bands.map((b) => b.band)}
                            busy={busy}
                            onCancel={() => setEditing(null)}
                            onSave={(input) => void run(() => api.patch(`${SCHOOL_SECTIONS_URL}/${section.id}`, input), `${input.name} saved.`)}
                            onDelete={() => void (async () => {
                                if (!(await askConfirm(`Remove ${section.name}?`, 'Its classes will be signed by the school-wide principal again.', 'Remove'))) return;
                                await run(() => api.del(`${SCHOOL_SECTIONS_URL}/${section.id}`), `${section.name} removed.`);
                            })()}
                        />
                    ) : (
                        <Card style={{ marginBottom: spacing.sm }}>
                            <View style={styles.head}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{section.name}</Text>
                                    <Text style={styles.meta}>{listBands(section.bands)}</Text>
                                    <Text style={styles.meta}>{section.head_title}: {section.head_name ?? 'name not set'}</Text>
                                </View>
                                <Button size="sm" variant="secondary" label="Edit" onPress={() => setEditing(section.id)} disabled={busy} />
                            </View>
                        </Card>
                    )}
                    <SignatureCard
                        key={`${section.id}:${section.head_name ?? ''}`}
                        target={sectionSignatureTarget(section.id)}
                        title={`${section.name}: ${section.head_title}’s signature`}
                        description={`Printed on ${section.name} report cards and mark sheets.`}
                    />
                </View>
            ))}
        </View>
    );
}

function SectionEditor({ section, sections, bands, busy, onSave, onCancel, onDelete }: {
    section?: SchoolSection;
    sections: readonly SchoolSection[];
    /** The bands the school teaches. */
    bands: readonly CurriculumBand[];
    busy: boolean;
    onSave: (input: SchoolSectionInput) => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const [name, setName] = useState(section?.name ?? '');
    const [title, setTitle] = useState(section?.head_title ?? 'Principal');
    const [head, setHead] = useState(section?.head_name ?? '');
    const [chosen, setChosen] = useState<CurriculumBand[]>(section?.bands ?? []);
    const toggle = (band: CurriculumBand, on: boolean) => setChosen((c) => (on ? [...c, band] : c.filter((b) => b !== band)));

    return (
        <Card style={{ marginBottom: spacing.sm }}>
            <TextField label="Section name" value={name} onChangeText={setName} placeholder="e.g. Junior School" />
            <TextField label="Head’s title (printed on the cards)" value={title} onChangeText={setTitle} placeholder="e.g. Principal, Head teacher" />
            <TextField label="Head’s name" value={head} onChangeText={setHead} placeholder="e.g. Mrs. Jane Wanjiku" />
            <SectionLabel>Classes in this section</SectionLabel>
            {bands.map((band) => {
                const owner = sections.find((s) => s.id !== section?.id && s.bands.includes(band));
                return (
                    <ToggleRow
                        key={band}
                        label={bandLabel(band)}
                        description={owner ? `In ${owner.name} now` : undefined}
                        value={chosen.includes(band)}
                        onValueChange={(on) => toggle(band, on)}
                    />
                );
            })}
            <ButtonRow>
                {onDelete ? <Button size="sm" variant="danger" label="Remove" onPress={onDelete} disabled={busy} /> : null}
                <Button size="sm" variant="secondary" label="Cancel" onPress={onCancel} disabled={busy} />
                <Button
                    size="sm"
                    label="Save"
                    loading={busy}
                    onPress={() => onSave({ name: name.trim(), bands: chosen, head_title: title.trim(), head_name: head.trim() || null })}
                />
            </ButtonRow>
        </Card>
    );
}

const useStyles = makeStyles((colors) => ({
    note: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    name: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
}));
