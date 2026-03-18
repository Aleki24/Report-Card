import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required');
                }

                const supabase = createSupabaseAdmin();

                // Look up user by email
                const { data: user, error } = await supabase
                    .from('users')
                    .select('id, email, password_hash, role, school_id, first_name, last_name, is_active')
                    .eq('email', credentials.email.trim())
                    .single();

                if (error || !user) {
                    throw new Error('Invalid email or password');
                }

                if (!user.is_active) {
                    throw new Error('Account is deactivated. Contact your administrator.');
                }

                if (!user.password_hash) {
                    throw new Error('No password set for this account. Contact your administrator.');
                }

                // Verify password
                const isValid = await bcrypt.compare(credentials.password, user.password_hash);
                if (!isValid) {
                    throw new Error('Invalid email or password');
                }

                // Fetch school name if user has a school_id
                let schoolName: string | null = null;
                if (user.school_id) {
                    const { data: schoolData } = await supabase
                        .from('schools')
                        .select('name')
                        .eq('id', user.school_id)
                        .single();
                    schoolName = schoolData?.name || null;
                }

                // Return user object — this gets encoded in the JWT
                return {
                    id: user.id,
                    email: user.email,
                    name: `${user.first_name} ${user.last_name}`,
                    role: user.role,
                    schoolId: user.school_id,
                    schoolName,
                    firstName: user.first_name,
                    lastName: user.last_name,
                };
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            // On initial sign-in, merge user data into the JWT
            if (user) {
                token.userId = user.id;
                token.role = (user as any).role;
                token.schoolId = (user as any).schoolId;
                token.schoolName = (user as any).schoolName;
                token.firstName = (user as any).firstName;
                token.lastName = (user as any).lastName;
            }
            return token;
        },
        async session({ session, token }) {
            // Expose custom fields on the session object
            if (session.user) {
                (session.user as any).id = token.userId;
                (session.user as any).role = token.role;
                (session.user as any).schoolId = token.schoolId;
                (session.user as any).schoolName = token.schoolName;
                (session.user as any).firstName = token.firstName;
                (session.user as any).lastName = token.lastName;
            }
            return session;
        },
    },
};
