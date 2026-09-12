import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function getSafeNextPath(value: string | null) {
  if (!value) {
    return "/";
  }

  if (!value.startsWith("/")) {
    return "/";
  }

  if (value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(
    requestUrl.searchParams.get("next")
  );

  if (code) {
    const supabase = await createSupabaseServerClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(next, requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(
    new URL(
      "/auth?error=auth_callback_failed",
      requestUrl.origin
    )
  );
}