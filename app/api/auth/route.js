const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cricket@123';

export async function POST(req) {
  const { password } = await req.json();
  if (password === ADMIN_PASSWORD) {
    return Response.json({ ok: true, token: ADMIN_PASSWORD });
  }
  return Response.json({ ok: false, error: 'Wrong password' }, { status: 401 });
}
