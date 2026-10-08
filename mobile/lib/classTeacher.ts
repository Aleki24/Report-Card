import { CLASS_TEACHER_REPLACE } from '@shared/class-teacher';
import { ApiError } from './api';
import { askConfirm } from './confirm';

/**
 * Sends a class teacher change. When it would replace someone (the class has
 * a class teacher, or the teacher leaves another class) the server answers
 * with the question to ask; on yes it is sent again with `replace`.
 * Resolves false when the admin says no.
 */
export async function sendConfirmingReplace(send: (replace: boolean) => Promise<unknown>): Promise<boolean> {
    try {
        await send(false);
        return true;
    } catch (err) {
        if (!(err instanceof ApiError) || err.code !== CLASS_TEACHER_REPLACE) throw err;
        if (!(await askConfirm('Change class teacher?', err.message, 'Change'))) return false;
        await send(true);
        return true;
    }
}
