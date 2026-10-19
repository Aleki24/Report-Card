import { NextResponse } from 'next/server';
import type { UserJSON, WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { provisionUserFromClerk } from '@/lib/provision-user';
import { closeAccount } from '@/lib/account-closing';

/** The account's primary email (Clerk lists every address; the first is not always the primary). */
const primaryEmail = (user: UserJSON): string =>
  (user.email_addresses.find(e => e.id === user.primary_email_address_id) ?? user.email_addresses[0])?.email_address ?? '';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Svix signs the exact bytes it sent. Verifying JSON.stringify(req.json())
  // instead re-serialises the body, which does not always reproduce those
  // bytes (escaped unicode in a name, number formatting), so genuine events
  // were intermittently rejected and the user never synced.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;
  try {
    evt = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    switch (evt.type) {
      case 'user.created': {
        const data = evt.data;
        const clerkId = data.id;
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('id', clerkId)
          .maybeSingle();

        if (existing) break;

        const { error: provisionErr } = await provisionUserFromClerk(supabase, {
          id: clerkId,
          email: primaryEmail(data),
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          publicMetadata: data.public_metadata || {},
        });
        if (provisionErr) console.error('[Clerk Webhook] Failed to create user:', provisionErr);
        break;
      }

      case 'user.updated': {
        // The database is the source of truth for role, school and names:
        // admins change them there (Users page, class teacher changes), and
        // Clerk's copy is not kept in step. Writing Clerk's back on every
        // update (a photo change, a role switch) restored roles admins had
        // taken away. Only the sign-in email is Clerk's to own.
        const email = primaryEmail(evt.data);
        if (email) {
          const { error } = await supabase.from('users').update({ email }).eq('id', evt.data.id);
          if (error) console.error('[Clerk Webhook] Failed to sync email:', error);
        }
        break;
      }

      case 'user.deleted': {
        const clerkId = evt.data.id;
        if (!clerkId) break;
        // Our own routes settle the database before they delete a Clerk user;
        // a deletion from the Clerk dashboard (e.g. a request by email) lands
        // here and closes the account exactly as the person's own request
        // does: a learner's school record is kept, without their details,
        // and every email and username is freed for a new account.
        const { data: row } = await supabase.from('users').select('role').eq('id', clerkId).maybeSingle();
        if (!row) break;
        const { error } = await closeAccount(supabase, clerkId, row.role);
        if (error) console.error('[Clerk Webhook] Failed to close account:', clerkId, error);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
