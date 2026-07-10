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
          .maybeSingle();

        if (existing) break;

        const role = metadata.role || 'PENDING';
        let schoolId = metadata.school_id || null;

        // Only auto-create school if user explicitly has ADMIN role in metadata
        if (metadata.role === 'ADMIN' && !schoolId) {
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

        // Sync role and school_id back to Clerk publicMetadata for session claims
        try {
          const { createClerkClient } = await import('@clerk/nextjs/server');
          const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
          await clerk.users.updateUser(clerkId, {
            publicMetadata: { role, school_id: schoolId },
          });
        } catch (metaErr) {
          console.error('[Clerk Webhook] Failed to sync metadata:', metaErr);
        }
        break;
      }

      case 'user.updated': {
        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address || '';
        const firstName = data.first_name || '';
        const lastName = data.last_name || '';
        const metadata = data.public_metadata || {};

        const updateData: any = {
          email,
          first_name: firstName,
          last_name: lastName,
        };

        if (metadata.role) updateData.role = metadata.role;
        if (metadata.school_id) updateData.school_id = metadata.school_id;

        await supabase
          .from('users')
          .update(updateData)
          .eq('id', clerkId);
        break;
      }

      case 'user.deleted': {
        const clerkId = data.id;
        if (!clerkId) break;
        // Cascade delete related records to avoid FK constraint errors
        await supabase.from('exam_marks').delete().eq('student_id', clerkId);
        await supabase.from('daily_attendance').delete().eq('student_id', clerkId);
        await supabase.from('student_fees').delete().eq('student_id', clerkId);
        await supabase.from('announcements').delete().eq('posted_by', clerkId);
        await supabase.from('students').delete().eq('id', clerkId);
        await supabase.from('class_teachers').delete().eq('user_id', clerkId);
        const { data: stRecord } = await supabase.from('subject_teachers').select('id').eq('user_id', clerkId).maybeSingle();
        if (stRecord) {
          await supabase.from('subject_teacher_assignments').delete().eq('subject_teacher_id', stRecord.id);
          await supabase.from('subject_teachers').delete().eq('id', stRecord.id);
        }
        await supabase.from('active_users').delete().eq('user_id', clerkId);
        await supabase.from('users').delete().eq('id', clerkId);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
