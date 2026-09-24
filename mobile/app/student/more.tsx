import React from 'react';
import { Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { STUDENT_OVERFLOW, STUDENT_SCREENS } from '@/lib/roles';
import { ListCard, ListRow, Screen, ScreenHeader } from '@/components/ui';

export default function StudentMoreScreen() {
    const router = useRouter();
    return (
        <Screen>
            <ScreenHeader title="More" />
            <ListCard>
                {STUDENT_OVERFLOW.map((name) => {
                    const meta = STUDENT_SCREENS[name];
                    return (
                        <ListRow
                            key={name}
                            title={meta.title}
                            subtitle={meta.description}
                            left={<Text style={{ fontSize: 22 }}>{meta.icon}</Text>}
                            onPress={() => router.push(meta.href as Href)}
                        />
                    );
                })}
            </ListCard>
        </Screen>
    );
}
