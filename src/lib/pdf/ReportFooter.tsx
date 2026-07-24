import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { f } from './pdfStyles';

/**
 * The one footer every report card template uses.
 *
 * The previous footer stacked four centred lines (generation date, next
 * term, "Skulbase", a disclaimer) which read as clutter under an already
 * dense page. This is a single hairline rule and one balanced line:
 * the SkulBase mark on the left, the page's meta on the right. Nothing
 * competes with the report itself.
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
            <View style={f.rule} />
            <View style={f.bar}>
                <View style={f.brand}>
                    <View style={f.brandMark}><Text style={f.brandMarkText}>S</Text></View>
                    <Text style={f.brandName}>SkulBase</Text>
                    <Text style={f.brandTag}>· School Management System</Text>
                </View>
                <Text style={f.meta}>{meta}</Text>
            </View>
        </View>
    );
}
