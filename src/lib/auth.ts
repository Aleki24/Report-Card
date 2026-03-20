import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { UserRole } from '@/types';

interface DbUser {
    id: string;
    email: string;
    password_hash: string | null;
    role: UserRole;
    school_id: string | null;
    first_name: string;
    last_name: string;
    is_active: boolean;
}

interface SessionUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    schoolId: string | null;
    schoolName: string | null;
    firstName: string;
    lastName: string;
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials): Promise<SessionUser | null> {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required');
                }

                const supabase = createSupabaseAdmin();

                const { data: user, error } = await supabase
                    .from('users')
                    .select('id, email, password_hash, role, school_id, first_name, last_name, is_active')
                    .eq('email', credentials.email.trim())
                    .single();

                if (error || !user) {
                    throw new Error('Invalid email or password');
                }

                const dbUser = user as DbUser;

                if (!dbUser.is_active) {
                    throw new Error('Account is deactivated. Contact your administrator.');
                }

                if (!dbUser.password_hash) {
                    throw new Error('No password set for this account. Contact your administrator.');
                }

                const isValid = await bcrypt.compare(credentials.password, dbUser.password_hash);
                if (!isValid) {
                    throw new Error('Invalid email or password');
                }

                let schoolName: string | null = null;
                if (dbUser.school_id) {
                    const { data: schoolData } = await supabase
                        .from('schools')
                        .select('name')
                        .eq('id', dbUser.school_id)
                        .single();
                    schoolName = schoolData?.name || null;
                }

                return {
                    id: dbUser.id,
                    email: dbUser.email,
                    name: `${dbUser.first_name} ${dbUser.last_name}`,
                    role: dbUser.role,
                    schoolId: dbUser.school_id,
                    schoolName,
                    firstName: dbUser.first_name,
                    lastName: dbUser.last_name,
                };
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const sessionUser = user as SessionUser;
                token.userId = sessionUser.id;
                token.role = sessionUser.role;
                token.schoolId = sessionUser.schoolId;
                token.schoolName = sessionUser.schoolName;
                token.firstName = sessionUser.firstName;
                token.lastName = sessionUser.lastName;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as SessionUser & { id: string }).id = token.userId as string;
                (session.user as SessionUser & { role: UserRole }).role = token.role as UserRole;
                (session.user as SessionUser & { schoolId: string | null }).schoolId = token.schoolId as string | null;
                (session.user as SessionUser & { schoolName: string | null }).schoolName = token.schoolName as string | null;
                (session.user as SessionUser & { firstName: string }).firstName = token.firstName as string;
                (session.user as SessionUser & { lastName: string }).lastName = token.lastName as string;
            }
            return session;
        },
    },
};
