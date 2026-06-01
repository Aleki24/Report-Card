import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const wh = new Webhook(webhookSecret);
  let evt: any;
  try {
    evt = wh.verify(JSON.stringify(payload), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const { type, data } = evt;
  const supabase = createSupabaseAdmin();

  try {
    switch (type) {
      case 'user.created': {
        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address || '';
        const firstName = data.first_name || '';
        const lastName = data.last_name || '';
        const metadata = data.public_metadata || {};

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('id', clerkId)
          .single();

        if (existing) break;

        const role = metadata.role || 'ADMIN';
        let schoolId = metadata.school_id || null;

        if (role === 'ADMIN' && !schoolId) {
          const schoolIdNew = crypto.randomUUID();
          const { error: schoolErr } = await supabase.from('schools').insert({
            id: schoolIdNew,
            name: `${firstName}'s School`,
          });
          if (!schoolErr) schoolId = schoolIdNew;
        }

        await supabase.from('users').insert({
          id: clerkId,
          first_name: firstName,
          last_name: lastName,
          email,
          username: email.split('@')[0] || clerkId,
          role,
          is_active: true,
          school_id: schoolId,
        });

        // Sync role and schoolId back to Clerk publicMetadata for session claims
        const clerkSecretKey = process.env.CLERK_SECRET_KEY;
        if (clerkSecretKey) {
          try {
            await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                public_metadata: { role, schoolId },
              }),
            });
          } catch (metaErr) {
            console.error('[Clerk Webhook] Failed to sync metadata:', metaErr);
          }
        }
        break;
      }

      case 'user.updated': {
        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address || '';
        const firstName = data.first_name || '';
        const lastName = data.last_name || '';

        await supabase
          .from('users')
          .update({ email, first_name: firstName, last_name: lastName })
          .eq('id', clerkId);
        break;
      }

      case 'user.deleted': {
        const clerkId = data.id;
        await supabase.from('users').delete().eq('id', clerkId);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
