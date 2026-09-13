import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReviewPanel from '../app/compliance-officer/ReviewPanel'
import { ToastProvider } from '../components/Toast'
import type { DocumentItem } from '../types/document'

describe('ReviewPanel Degraded State Handling', () => {
  let currentAnalysis: any = null

  beforeEach(() => {
    currentAnalysis = null
    // Mock global fetch for claim, analysis, and thread requests
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/claim')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'Claimed' }),
        })
      }
      if (url.includes('/thread')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ thread_root_id: 'doc-1', total_versions: 1, versions: [] }),
        })
      }
      if (url.includes('/analysis')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentAnalysis || {}),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
    })

    // Mock localStorage
    const store: Record<string, string> = { auth_token: 'test-token' }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders degraded AI state banner and notice when AI assist is in degraded fallback mode', async () => {
    const degradedDoc: DocumentItem = {
      id: 'doc-degraded-123',
      name: 'Client_Portfolio_Review.pdf',
      filename: 'Client_Portfolio_Review.pdf',
      status: 'pending',
      uploaded: '2026-09-11',
      file_type: 'pdf',
      ai_analysis: {
        status: 'completed',
        summary: 'AI Assist unavailable (API Key missing, rate-limited, or service degraded). Officer manual review required.',
        degraded: true,
        provider: 'degraded_fallback',
        flags: [],
      },
    }
    currentAnalysis = degradedDoc.ai_analysis

    const mockSuccess = vi.fn()
    const mockStatusChange = vi.fn()

    render(
      <ToastProvider>
        <ReviewPanel doc={degradedDoc} onSuccess={mockSuccess} onStatusChange={mockStatusChange} />
      </ToastProvider>
    )

    // Verify degraded banner is prominently rendered
    const degradedBanner = await screen.findByTestId('degraded-state-banner')
    expect(degradedBanner).toBeInTheDocument()
    expect(screen.getByText('AI Assist Degraded / Fallback Mode')).toBeInTheDocument()

    // Verify degraded summary message
    expect(
      screen.getByText(/AI Assist unavailable \(API Key missing, rate-limited, or service degraded\)/i)
    ).toBeInTheDocument()

    // Verify notice under Compliance Flags
    expect(
      screen.getByText('Automated rule checking unavailable due to degraded service. Officer manual review required.')
    ).toBeInTheDocument()

    // Test transition from degraded warning to manual decision mode
    const proceedButton = screen.getByRole('button', { name: /Proceed with Manual Decision/i })
    expect(proceedButton).toBeInTheDocument()
    fireEvent.click(proceedButton)

    // Form title for manual decision should now be visible
    expect(screen.getByText('Final decision')).toBeInTheDocument()
    expect(screen.getByText(/Review the AI findings and record your determination/i)).toBeInTheDocument()
  })

  it('renders unsupported file format warning when document has unsupported_for_ai error_type', async () => {
    const unsupportedDoc: DocumentItem = {
      id: 'doc-unsupported-456',
      name: 'Scanned_Agreement.pdf',
      filename: 'Scanned_Agreement.pdf',
      status: 'pending',
      uploaded: '2026-09-11',
      file_type: 'pdf',
      ai_analysis: {
        status: 'completed',
        error_type: 'unsupported_for_ai',
        manual_review_required: true,
        summary: 'Scanned image-only PDF without extractable text.',
        flags: [],
      },
    }
    currentAnalysis = unsupportedDoc.ai_analysis

    render(
      <ToastProvider>
        <ReviewPanel doc={unsupportedDoc} onSuccess={vi.fn()} />
      </ToastProvider>
    )

    // Banner heading for unsupported format
    expect(await screen.findByText('File Not Supported for Automated AI Analysis')).toBeInTheDocument()
    expect(
      screen.getByText('Automated rule checking bypassed due to unsupported file format. Manual revision/review required.')
    ).toBeInTheDocument()
  })
})
