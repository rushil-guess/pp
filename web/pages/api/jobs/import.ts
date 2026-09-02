import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { prisma } from '../../../lib/prisma'

// Basic ingestion endpoint: fetch RemoteOK and persist to DB with simple duplicate detection.
// Duplicate detection strategy (initial): match on externalId when present OR
// (normalized title + company + location) key. Future: use text similarity or embeddings.

function normalizeText(t?: string) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const r = await axios.get('https://remoteok.com/api')
    const jobs = Array.isArray(r.data) ? r.data.slice(1) : []
    let imported = 0
    const failures: string[] = []

    for (const j of jobs) {
      try {
        const externalId = j.id ? String(j.id) : null
        const title = j.position || j.title || j.role || ''
        const companyName = j.company || 'Unknown'
        const location = j.location || ''
        const originalUrl = j.url || j.redirect_url || null
        const description = j.description || j.excerpt || ''

        // find or create company
        let company = null
        if (companyName) {
          company = await prisma.company.upsert({
            where: { name: companyName },
            update: { logoUrl: j.logo || undefined },
            create: { name: companyName, logoUrl: j.logo || undefined },
          })
        }

        // duplicate detection
        let existing = null
        if (externalId) {
          existing = await prisma.job.findFirst({ where: { externalId } })
        }
        if (!existing) {
          const key = `${normalizeText(title)}|${normalizeText(companyName)}|${normalizeText(location)}`
          existing = await prisma.job.findFirst({
            where: {
              AND: [
                { title: { contains: normalizeText(title), mode: 'insensitive' } },
                { company: { is: { name: companyName } } },
              ],
            },
          })
        }

        if (existing) {
          // update lastVerifiedAt and source info
          await prisma.job.update({
            where: { id: existing.id },
            data: {
              lastVerifiedAt: new Date(),
              description: description || existing.description,
              originalUrl: originalUrl || existing.originalUrl,
            },
          })
        } else {
          await prisma.job.create({
            data: {
              externalId: externalId || undefined,
              title,
              company: company ? { connect: { id: company.id } } : undefined,
              location,
              remote: j.tags && j.tags.includes('remote'),
              employmentType: null,
              experienceLevel: null,
              salary: j.salary || null,
              skills: j.tags || [],
              description: description || '',
              postedAt: j.date ? new Date(j.date) : undefined,
              source: { connectOrCreate: { where: { name: 'RemoteOK' }, create: { name: 'RemoteOK', feedUrl: 'https://remoteok.com' } } },
              originalUrl: originalUrl || '',
              applicationUrl: originalUrl || '',
              lastVerifiedAt: new Date(),
              verified: true,
            },
          })
          imported++
        }
      } catch (e: any) {
        failures.push(String(e?.message || e))
      }
    }

    res.status(200).json({ imported, failures })
  } catch (err: any) {
    console.error('import error', err?.message || err)
    res.status(500).json({ error: 'failed to import jobs', details: err?.message })
  }
}
