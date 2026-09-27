import { route } from '@/lib/platform/access';
import { createRow, listRows, resolveResource } from '@/lib/ops/crud-server';

type Params = { resource: string };

export const GET = route<Params>('ops list', {}, ({ access, request, params }) =>
    listRows(resolveResource(params.resource), access, request.nextUrl.searchParams));

export const POST = route<Params>('ops create', {}, async ({ access, request, params }) =>
    createRow(resolveResource(params.resource), access, await request.json().catch(() => null)));
