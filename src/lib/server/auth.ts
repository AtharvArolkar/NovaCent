import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { collections, getDb } from "@/lib/server/mongodb";
import { credentialsSchema } from "@/lib/server/schemas";
import { appConfig } from "@/lib/app-config";
import type { Account } from "@/lib/domain";

export interface AppSessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  defaultAccountId?: string;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  passwordHash?: string;
  provider: "credentials" | "google";
  defaultAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

async function ensureDefaultAccount(user: StoredUser) {
  const db = await getDb();
  if (user.defaultAccountId) {
    return user.defaultAccountId;
  }

  const now = new Date().toISOString();
  const accountId = crypto.randomUUID();
  await db.collection(collections.accounts).insertOne({
    id: accountId,
    userId: user.id,
    name: "Primary Account",
    baseCurrency: appConfig.baseCurrency,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  });
  await db.collection(collections.users).updateOne({ id: user.id }, { $set: { defaultAccountId: accountId, updatedAt: now } });
  return accountId;
}

async function upsertGoogleUser(profile: { email?: string | null; name?: string | null; image?: string | null }) {
  if (!profile.email) {
    return null;
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const email = profile.email.toLowerCase();
  const existing = await db.collection<StoredUser>(collections.users).findOne({ email });

  if (existing) {
    await db.collection(collections.users).updateOne(
      { id: existing.id },
      {
        $set: {
          name: profile.name ?? existing.name,
          image: profile.image ?? existing.image,
          updatedAt: now
        }
      }
    );
    await ensureDefaultAccount(existing);
    return existing.id;
  }

  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: profile.name ?? email.split("@")[0],
    email,
    image: profile.image ?? undefined,
    provider: "google",
    createdAt: now,
    updatedAt: now
  };
  await db.collection(collections.users).insertOne(user);
  await ensureDefaultAccount(user);
  return user.id;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.parse(credentials);
        const db = await getDb();
        const user = await db.collection<StoredUser>(collections.users).findOne({ email: parsed.email });

        if (!user?.passwordHash) {
          return null;
        }

        const validPassword = await bcrypt.compare(parsed.password, user.passwordHash);
        if (!validPassword) {
          return null;
        }

        const defaultAccountId = await ensureDefaultAccount(user);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          defaultAccountId
        } as AppSessionUser;
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "missing-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "missing-google-client-secret"
    })
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const googleUserId = await upsertGoogleUser({
          email: profile?.email ?? user.email,
          name: profile?.name ?? user.name,
          image: user.image
        });
        if (googleUserId) {
          user.id = googleUserId;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.defaultAccountId = (user as AppSessionUser).defaultAccountId;
      }

      if (trigger === "update") {
        const nextName = typeof session?.user?.name === "string" ? session.user.name.trim() : "";
        if (nextName) {
          token.name = nextName;
        }
      }

      if (token.email && !token.defaultAccountId) {
        const db = await getDb();
        const stored = await db.collection<StoredUser>(collections.users).findOne({ email: token.email.toLowerCase() });
        if (stored) {
          token.id = stored.id;
          token.defaultAccountId = await ensureDefaultAccount(stored);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as AppSessionUser).id = String(token.id);
        (session.user as AppSessionUser).name = typeof token.name === "string" ? token.name : session.user.name;
        (session.user as AppSessionUser).defaultAccountId = token.defaultAccountId ? String(token.defaultAccountId) : undefined;
      }
      return session;
    }
  }
};

export async function getCurrentUser(): Promise<AppSessionUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AppSessionUser | undefined;

  if (!user?.id) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireAccountAccess(accountId?: string | null) {
  const user = await getCurrentUser();
  const db = await getDb();
  const requestedAccountId = accountId ?? user.defaultAccountId;

  if (!requestedAccountId) {
    throw new Error("Forbidden: no account selected");
  }

  const account = await db.collection<Account>(collections.accounts).findOne({ id: requestedAccountId, userId: user.id });

  if (!account) {
    throw new Error("Forbidden: account is not available for this user");
  }

  return {
    user,
    accountId: requestedAccountId,
    account
  };
}

export function accountIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return request.headers.get("x-account-id") ?? url.searchParams.get("accountId");
}
