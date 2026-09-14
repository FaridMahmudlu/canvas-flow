import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible Auth.js configuration.
 * Contains no database adapters or Node-specific dependencies (e.g. bcrypt, Prisma),
 * making it fully safe for Next.js Edge Middleware and client-side consumption.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    newUser: '/connect',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Configured in Node-runtime auth.ts with Credentials & Prisma
};
