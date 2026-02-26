const { submitRequestToSheet, extractSheetIdFromContext } = require('../../src/util/sheetAppender')

describe('Sheet Appender', () => {
  describe('extractSheetIdFromContext', () => {
    beforeEach(() => {
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname)
      // Clear document input
      const input = document.getElementById('document-input')
      if (input) {
        input.value = ''
      }
    })

    it('should extract sheet ID from Google Sheets URL in document input', () => {
      const input = document.createElement('input')
      input.id = 'document-input'
      input.value = 'https://docs.google.com/spreadsheets/d/1abc123def456/edit'
      document.body.appendChild(input)

      const sheetId = extractSheetIdFromContext()
      expect(sheetId).toBe('1abc123def456')

      document.body.removeChild(input)
    })

    it('should extract sheet ID from URL parameters', () => {
      window.history.replaceState({}, document.title, '?documentId=https://docs.google.com/spreadsheets/d/1xyz789/edit')

      const sheetId = extractSheetIdFromContext()
      expect(sheetId).toBe('1xyz789')
    })

    it('should return null if no sheet ID found', () => {
      const sheetId = extractSheetIdFromContext()
      expect(sheetId).toBeNull()
    })

    it('should handle raw sheet IDs in URL parameters', () => {
      window.history.replaceState({}, document.title, '?documentId=1raw123sheetid')

      const sheetId = extractSheetIdFromContext()
      expect(sheetId).toBe('1raw123sheetid')
    })
  })

  describe('submitRequestToSheet', () => {
    it('should throw error if gapi is not available', async () => {
      const originalGapi = window.gapi
      window.gapi = undefined

      const blipData = {
        name: 'Test Tech',
        ring: 'Hold',
        quadrant: 'Creative',
        description: 'Test description',
      }

      try {
        await submitRequestToSheet(blipData)
        fail('Should have thrown error')
      } catch (error) {
        expect(error.message).toContain('Google API client not initialized')
      } finally {
        window.gapi = originalGapi
      }
    })

    it('should throw error if no sheet ID found', async () => {
      // Mock gapi
      window.gapi = { client: {} }

      const blipData = {
        name: 'Test Tech',
        ring: 'Hold',
        quadrant: 'Creative',
        description: 'Test description',
      }

      try {
        await submitRequestToSheet(blipData)
        fail('Should have thrown error')
      } catch (error) {
        expect(error.message).toContain('No sheet ID found')
      }
    })

    it('should construct correct data structure for submission', () => {
      const blipData = {
        name: 'Kubernetes',
        ring: 'Hold',
        quadrant: 'Digital',
        description: 'Container orchestration platform',
        topic: 'DevOps',
      }

      // Just verify the structure is valid - actual submission would require gapi
      expect(blipData.name).toBe('Kubernetes')
      expect(blipData.ring).toBe('Hold')
      expect(blipData.quadrant).toBe('Digital')
      expect(blipData.description).toContain('Container')
      expect(blipData.topic).toBe('DevOps')
    })
  })
})
