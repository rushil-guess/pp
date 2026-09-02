import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

// Fetch latest remote jobs from RemoteOK (server-side)
// Docs: https://remoteok.com/api

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const r = await axios.get('https://remoteok.com/api')
    // RemoteOK returns an array with a first element meta; filter out meta entries
    const jobs = Array.isArray(r.data) ? r.data.slice(1) : []
    // Map to our minimal shape
    const mapped = jobs.map((j: any) => ({
      externalId: j.id || j.position || null,
      title: j.position || j.title || j.role,
      company: j.company,
      companyLogo: j.logo,
      location: j.location || null,
      remote: j.tags && j.tags.includes('remote'),
      employmentType: null,
      experienceLevel: null,
      salary: j.salary || null,
      skills: j.tags || [],
      description: j.description || j.excerpt || j.position || '',
      postedAt: j.date ? new Date(j.date) : null,
      source: 'RemoteOK',
      originalUrl: j.url || j.redirect_url || null,
    }))

    res.status(200).json({ count: mapped.length, jobs: mapped })
  } catch (err: any) {
    console.error('fetch-remoteok error', err?.message || err)
    res.status(500).json({ error: 'failed to fetch remoteok', details: err?.message })
  }
}
