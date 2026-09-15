import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

const pageSize = 1000;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ message: 'Method not allowed.' }, { status: 405 });
    }

    const body = await req.json().catch(() => null);
    if (body?.confirmation !== 'DELETE') {
      return Response.json(
        { message: 'Account deletion was not confirmed.' },
        { status: 400 },
      );
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ message: 'User identity is missing.' }, { status: 401 });
    }

    const storagePaths: string[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await ctx.supabase
        .from('session_photos')
        .select('storage_path')
        .order('id')
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      storagePaths.push(...data.map((photo) => photo.storage_path));
      if (data.length < pageSize) break;
    }

    for (let offset = 0; offset < storagePaths.length; offset += pageSize) {
      const { error } = await ctx.supabaseAdmin.storage
        .from('session-photos')
        .remove(storagePaths.slice(offset, offset + pageSize));
      if (error) throw error;
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return Response.json({ deleted: true });
  }),
};
