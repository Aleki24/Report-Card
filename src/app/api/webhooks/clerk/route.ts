import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { existingSchoolId, provisionUserFromClerk } from '@/lib/provision-user';

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
  let evt: any;
  try {
    evt = wh.verify(rawBody, {
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
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('id', clerkId)
          .maybeSingle();

        if (existing) break;

        const { error: provisionErr } = await provisionUserFromClerk(supabase, {
          id: clerkId,
          email: data.email_addresses?.[0]?.email_address || '',
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          publicMetadata: data.public_metadata || {},
        });
        if (provisionErr) console.error('[Clerk Webhook] Failed to create user:', provisionErr);
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
        // A school id for a school that no longer exists would fail the FK
        // check and drop the whole update (name and email included).
        const schoolId = await existingSchoolId(supabase, metadata.school_id);
        if (schoolId) updateData.school_id = schoolId;

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
