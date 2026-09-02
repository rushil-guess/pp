import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { prisma } from '../../../lib/prisma'

// Ingestion endpoint: fetch RemoteOK and Remotive and persist to DB with simple duplicate detection.
// Authorization: requires Authorization: Bearer <INGEST_SECRET> header when INGEST_SECRET is set.

function normalizeText(t?: string) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function mapRemoteOkJob(j: any) {
  return {
    externalId: j.id ? String(j.id) : null,
    title: j.position || j.title || j.role || '',
    companyName: j.company || 'Unknown',
    companyLogo: j.logo || null,
    location: j.location || '',
    remote: Array.isArray(j.tags) ? j.tags.includes('remote') : Boolean(j.tags && j.tags.toLowerCase && j.tags.toLowerCase().includes('remote')),
    employmentType: null,
    experienceLevel: null,
    salary: j.salary || null,
    skills: j.tags || [],
    description: j.description || j.excerpt || '',
    postedAt: j.date ? new Date(j.date) : null,
    sourceName: 'RemoteOK',
    originalUrl: j.url || j.redirect_url || null,
  }
}

function mapRemotiveJob(j: any) {
  return {
    externalId: j.id ? String(j.id) : (j.job_id ? String(j.job_id) : null),
    title: j.title || j.job_title || '',
    companyName: (j.company_name || j.company) || 'Unknown',
    companyLogo: j.company_logo || null,
    location: j.candidate_required_location || j.location || '',
    remote: (j.candidate_required_location || '').toLowerCase().includes('remote') || Boolean(j.remote) || false,
    employmentType: j.job_type || null,
    experienceLevel: null,
    salary: j.salary || null,
    skills: j.tags || [],
    description: j.description || j.short_description || '',
    postedAt: j.publication_date ? new Date(j.publication_date) : (j.date ? new Date(j.date) : null),
    sourceName: 'Remotive',
    originalUrl: j.url || j.job_url || null,
  }
}

async function upsertJob(jmapped: any) {
  const { externalId, title, companyName, companyLogo, location, remote, employmentType, experienceLevel, salary, skills, description, postedAt, sourceName, originalUrl } = jmapped

  // find or create company
  let company = null
  if (companyName) {
    company = await prisma.company.upsert({
      where: { name: companyName },
      update: { logoUrl: companyLogo || undefined },
      create: { name: companyName, logoUrl: companyLogo || undefined },
    })
  }

  // duplicate detection
  let existing = null
  if (externalId) {
    existing = await prisma.job.findFirst({ where: { externalId } })
  }
  if (!existing) {
    existing = await prisma.job.findFirst({
      where: {
        AND: [
          { title: { contains: normalizeText(title), mode: 'insensitive' } },
          company ? { company: { is: { name: companyName } } } : {},
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
    return false
  } else {
    await prisma.job.create({
      data: {
        externalId: externalId || undefined,
        title,
        company: company ? { connect: { id: company.id } } : undefined,
        location,
        remote: !!remote,
        employmentType: employmentType || null,
        experienceLevel: experienceLevel || null,
        salary: salary || null,
        skills: Array.isArray(skills) ? skills : [],
        description: description || '',
        postedAt: postedAt || undefined,
        source: { connectOrCreate: { where: { name: sourceName }, create: { name: sourceName, feedUrl: sourceName === 'RemoteOK' ? 'https://remoteok.com' : (sourceName === 'Remotive' ? 'https://remotive.io' : '') } } },
        originalUrl: originalUrl || '',
        applicationUrl: originalUrl || '',
        lastVerifiedAt: new Date(),
        verified: true,
      },
    })
    return true
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // authorization: if INGEST_SECRET is set in env, require it
    const ingestSecret = process.env.INGEST_SECRET
    if (ingestSecret) {
      const auth = req.headers.authorization ? String(req.headers.authorization).split(' ')[1] : null
      if (!auth || auth !== ingestSecret) {
        return res.status(401).json({ error: 'unauthorized' })
      }
    }

    // fetch RemoteOK
    const remoteokResp = await axios.get('https://remoteok.com/api')
    const remoteokJobs = Array.isArray(remoteokResp.data) ? remoteokResp.data.slice(1) : []
    // fetch Remotive
    const remotiveResp = await axios.get('https://remotive.io/api/remote-jobs')
    const remotiveJobs = remotiveResp.data && Array.isArray(remotiveResp.data.jobs) ? remotiveResp.data.jobs : []

    const allJobsRaw = [] as any[]
    for (const j of remoteokJobs) allJobsRaw.push(mapRemoteOkJob(j))
    for (const j of remotiveJobs) allJobsRaw.push(mapRemotiveJob(j))

    let imported = 0
    const failures: string[] = []

    for (const j of allJobsRaw) {
      try {
        const created = await upsertJob(j)
        if (created) imported++
      } catch (e: any) {
        failures.push(String(e?.message || e))
      }
    }

    res.status(200).json({ imported, failures, fetched: allJobsRaw.length })
  } catch (err: any) {
    console.error('import error', err?.message || err)
    res.status(500).json({ error: 'failed to import jobs', details: err?.message })
  }
}
