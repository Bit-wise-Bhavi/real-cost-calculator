import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  request: Request
) {
  const requestUrl = new URL(request.url);

  const code =
    requestUrl.searchParams.get("code");

  if (code) {
    const supabase =
      await createSupabaseServerClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(
        code
      );

    if (!error) {
      return NextResponse.redirect(
        new URL("/", requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(
    new URL("/auth?error=auth_callback_failed", requestUrl.origin)
  );
}