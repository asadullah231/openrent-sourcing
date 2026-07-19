import { getDrafts, getSendLog } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [drafts, log] = await Promise.all([getDrafts(), getSendLog()]);
  return Response.json({ drafts, log });
}
