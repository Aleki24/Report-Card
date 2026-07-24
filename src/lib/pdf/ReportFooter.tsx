import React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { f } from './pdfStyles';
import { T, APP_LOGO } from './pdfTheme';

/**
 * The one footer every report card template uses.
 *
 * Carries the product's own identity: the app logo, the wordmark set
 * lowercase in its two-tone treatment ("skul" blue, "base" green), and the
 * brand gradient as a hairline above it. The previous footer stacked four
 * centred lines of meta, which read as clutter under an already dense page;
 * this is one rule and one balanced line, so nothing competes with the
 * report itself.
 */
export function ReportFooter({
    generatedOn,
    openingDate,
}: {
    generatedOn: string;
    openingDate?: string;
}) {
    const meta = [
        openingDate ? `Next term begins ${openingDate}` : null,
        `Generated ${generatedOn}`,
    ].filter(Boolean).join('  ·  ');

    return (
        <View style={f.wrap} wrap={false}>
            {/* The app's blue → violet → cyan gradient, as a hairline rule. */}
            <View style={f.gradientRule}>
                <View style={{ flex: 2, backgroundColor: T.primary }} />
                <View style={{ flex: 1, backgroundColor: T.violet }} />
                <View style={{ flex: 1, backgroundColor: T.cyan }} />
            </View>
            <View style={f.bar}>
                <View style={f.brand}>
                    <Image style={f.brandLogo} src={APP_LOGO} />
                    <Text style={f.brandName}>
                        <Text style={{ color: T.brandBlue }}>skul</Text>
                        <Text style={{ color: T.brandGreen }}>base</Text>
                    </Text>
                    <Text style={f.brandTag}>· school management system</Text>
                </View>
                <Text style={f.meta}>{meta}</Text>
            </View>
        </View>
    );
}
