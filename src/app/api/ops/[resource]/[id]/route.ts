import { route } from '@/lib/platform/access';
import { deleteRow, updateRow, resolveResource } from '@/lib/ops/crud-server';

type Params = { resource: string; id: string };

export const PATCH = route<Params>('ops update', {}, async ({ access, request, params }) =>
    updateRow(resolveResource(params.resource), access, params.id, await request.json().catch(() => null)));

export const DELETE = route<Params>('ops delete', {}, async ({ access, params }) => {
    await deleteRow(resolveResource(params.resource), access, params.id);
    return { deleted: true };
});
