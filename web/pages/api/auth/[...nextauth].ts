import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '../../../lib/prisma'

export default NextAuth({
  adapter: PrismaAdapter(prisma as any),
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Minimal placeholder: implement secure password checks later
        if (!credentials?.email) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (user) return { id: user.id, email: user.email }
        // For initial dev, create a user automatically (remove in production)
        const newUser = await prisma.user.create({ data: { email: credentials.email } })
        return { id: newUser.id, email: newUser.email }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
})
