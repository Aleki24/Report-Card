import React, { useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { CircleAlert, Lightbulb } from 'lucide-react-native';
import type { Manual, ManualFigure, ManualSection } from '@shared/manual';
import { manualPdfHref } from '@shared/manual';
import { webUrl } from '@/lib/api';
import { fonts, radius, spacing, makeStyles, useTheme, shadowFor } from '@/lib/theme';
import { BackLink, Button } from '@/components/ui';

/** A web path from the manual data (`/manual/x.jpg`) on the web app's origin. */
function sitePath(path: string): string {
    return webUrl(path.startsWith('/') ? (path as `/${string}`) : `/${path}`);
}

function Figure({ figure }: { figure: ManualFigure }) {
    const styles = useStyles();
    const { width } = useWindowDimensions();
    const phone = figure.device === 'phone';
    // Phone screenshots are drawn narrower, as on the web.
    const frameWidth = phone ? Math.min(240, width * 0.6) : undefined;
    return (
        <View style={[styles.figure, phone && { alignSelf: 'center', width: frameWidth }]}>
            <View style={styles.figureFrame}>
                <Image
                    source={{ uri: sitePath(figure.src) }}
                    accessibilityLabel={figure.alt}
                    resizeMode="cover"
                    style={{ width: '100%', aspectRatio: figure.width / figure.height }}
                />
            </View>
            <Text style={styles.caption}>{figure.caption}</Text>
        </View>
    );
}

function Section({ section, number }: { section: ManualSection; number: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>
                <Text style={styles.sectionNumber}>{number}  </Text>
                {section.title}
            </Text>
            <Text style={styles.body}>{section.summary}</Text>
            {section.figure ? <Figure figure={section.figure} /> : null}
            {section.steps ? (
                <View style={styles.steps}>
                    {section.steps.map((step, i) => (
                        <View key={step.title} style={styles.step}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepTitle}>{step.title}</Text>
                                <Text style={styles.body}>{step.body}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}
            {section.points ? (
                <View style={styles.points}>
                    {section.points.map((point) => (
                        <View key={point} style={styles.point}>
                            <View style={styles.bullet} />
                            <Text style={[styles.body, { flex: 1 }]}>{point}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
            {section.tip ? (
                <View style={[styles.callout, styles.tip]}>
                    <Lightbulb size={16} color={colors.primary} />
                    <Text style={[styles.body, { flex: 1 }]}><Text style={styles.calloutLabel}>Tip: </Text>{section.tip}</Text>
                </View>
            ) : null}
            {section.caution ? (
                <View style={[styles.callout, styles.caution]}>
                    <CircleAlert size={16} color={colors.warning} />
                    <Text style={[styles.body, { flex: 1 }]}><Text style={styles.calloutLabel}>Good to know: </Text>{section.caution}</Text>
                </View>
            ) : null}
        </View>
    );
}

/**
 * A whole user guide — the web's ManualView: cover, contents that jump to each
 * chapter, and every section with its screenshot, steps and tips.
 */
export function ManualView({ manual }: { manual: Manual }) {
    const styles = useStyles();
    const scroll = useRef<ScrollView>(null);
    const chapterY = useRef<Record<string, number>>({});

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
                <View style={styles.content}>
                    <BackLink label="All guides" />
                    <View style={styles.cover}>
                        <Text style={styles.eyebrow}>{manual.audience}</Text>
                        <Text style={styles.title}>{manual.title}</Text>
                        <Text style={styles.body}>{manual.summary}</Text>
                        <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
                            <Button
                                size="sm"
                                variant="secondary"
                                label="Download PDF"
                                onPress={() => void WebBrowser.openBrowserAsync(sitePath(manualPdfHref(manual.slug)))}
                            />
                        </View>
                    </View>

                    <View style={styles.contents}>
                        <Text style={styles.contentsTitle}>Contents</Text>
                        {manual.chapters.map((chapter, c) => (
                            <Pressable
                                key={chapter.id}
                                accessibilityRole="link"
                                onPress={() => scroll.current?.scrollTo({ y: Math.max(0, (chapterY.current[chapter.id] ?? 0) - spacing.md), animated: true })}
                                style={({ pressed }) => [styles.contentsRow, pressed && { opacity: 0.6 }]}
                            >
                                <Text style={styles.contentsNumber}>{c + 1}.</Text>
                                <Text style={styles.contentsLabel}>{chapter.title}</Text>
                                <Text style={styles.contentsCount}>{chapter.sections.length}</Text>
                            </Pressable>
                        ))}
                    </View>

                    {manual.chapters.map((chapter, c) => (
                        <View key={chapter.id} onLayout={(e) => { chapterY.current[chapter.id] = e.nativeEvent.layout.y; }} style={styles.chapter}>
                            <Text style={styles.chapterEyebrow}>Chapter {c + 1}</Text>
                            <Text style={styles.chapterTitle}>{chapter.title}</Text>
                            <Text style={[styles.body, { marginBottom: spacing.md }]}>{chapter.intro}</Text>
                            {chapter.sections.map((section, s) => (
                                <Section key={section.id} section={section} number={`${c + 1}.${s + 1}`} />
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((colors) => ({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
    cover: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadowFor(colors) },
    eyebrow: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary, marginBottom: 4 },
    title: { fontSize: 24, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.3, marginBottom: spacing.sm },
    body: { fontSize: 15, lineHeight: 23, fontFamily: fonts.regular, color: colors.foreground },
    contents: { marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm },
    contentsTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    contentsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md - 2 },
    contentsNumber: { width: 22, fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
    contentsLabel: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    contentsCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
    chapter: { marginTop: spacing.xl },
    chapterEyebrow: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
    chapterTitle: { fontSize: 21, fontFamily: fonts.display, color: colors.foreground, marginTop: 2, marginBottom: spacing.sm },
    section: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
    sectionTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.foreground },
    sectionNumber: { color: colors.muted, fontFamily: fonts.medium },
    figure: { marginVertical: spacing.sm },
    figureFrame: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.mutedBg },
    caption: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
    steps: { gap: spacing.md, marginTop: spacing.xs },
    step: { flexDirection: 'row', gap: spacing.md },
    stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    stepNumberText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
    stepTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.foreground, marginBottom: 2 },
    points: { gap: spacing.sm },
    point: { flexDirection: 'row', gap: spacing.sm },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 9 },
    callout: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, marginTop: spacing.xs },
    tip: { backgroundColor: colors.infoBg, borderColor: colors.infoBorder },
    caution: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
    calloutLabel: { fontFamily: fonts.semibold },
}));
