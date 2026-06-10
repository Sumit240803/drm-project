import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { isSessionActive } from "@/lib/session";
import WatchClient from "./WatchClient";

export const dynamic = "force-dynamic";

export default async function WatchPage() {
  // Server-side guard: verify the session JWT, then confirm against Redis that
  // it hasn't been revoked or superseded by a newer login.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);

  if (!claims || !(await isSessionActive(claims))) {
    redirect("/");
  }

  return <WatchClient email={claims.email} />;
}
