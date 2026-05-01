import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login"
  }
});

export const config = {
  matcher: [
    "/",
    "/((?!api/auth|api/cron|login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)"
  ]
};
