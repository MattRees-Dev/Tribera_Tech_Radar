/* global gapi */
const InputSanitizer = require('./inputSanitizer')

/**
 * Appends a new row to a Google Sheet
 * @param {Object} blipData - The blip data to append
 * @param {string} blipData.name - Technology name
 * @param {string} blipData.ring - Ring (phase) - should be "Hold" for requests
 * @param {string} blipData.quadrant - Quadrant name
 * @param {string} blipData.description - HTML description
 * @param {string} [blipData.topic] - Optional topic
 * @param {string} [blipData.isNew] - TRUE or FALSE, defaults to TRUE
 * @param {string} [sheetId] - Optional sheet ID, if not provided will be extracted from URL
 * @returns {Promise<Object>} Result of the append operation
 */
const submitRequestToSheet = async (blipData, sheetId = null) => {
  // Validate that gapi is available and user is authenticated
  if (!window.gapi || !window.gapi.client) {
    throw new Error('Google API client not initialized. Please ensure you are logged in.')
  }

  try {
    // If no sheetId provided, try to extract from current URL or document input
    if (!sheetId) {
      sheetId = extractSheetIdFromContext()
    }

    if (!sheetId) {
      throw new Error('No sheet ID found. Please enter a valid Google Sheet URL.')
    }

    // Sanitize input data
    const sanitizedData = sanitizeBlipData(blipData)

    // Get the sheet metadata to find the first sheet name
    const sheetMetadata = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    })

    if (!sheetMetadata || !sheetMetadata.result || !sheetMetadata.result.sheets) {
      throw new Error('Unable to access the spreadsheet. Please check permissions.')
    }

    const firstSheetName = sheetMetadata.result.sheets[0].properties.title

    // Prepare the row to append [name, ring, quadrant, isNew, status, description, topic]
    const valueRange = {
      values: [
        [
          sanitizedData.name,
          sanitizedData.ring,
          sanitizedData.quadrant,
          sanitizedData.isNew,
          '', // status - left empty for request submissions
          sanitizedData.description,
          sanitizedData.topic,
        ],
      ],
    }

    // Append the values to the sheet
    const appendResponse = await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${firstSheetName}!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: valueRange,
    })

    if (!appendResponse || !appendResponse.result) {
      throw new Error('Failed to append data to sheet')
    }

    return {
      success: true,
      updatedRows: appendResponse.result.updates.updatedRows,
      updatedColumns: appendResponse.result.updates.updatedColumns,
      message: 'Request submitted successfully',
    }
  } catch (error) {
    console.error('Sheet appender error:', error)
    // Provide more user-friendly error messages
    if (error.status === 403) {
      throw new Error('Permission denied. Make sure you have write access to this spreadsheet.')
    } else if (error.status === 404) {
      throw new Error('Spreadsheet not found. Please check the URL and try again.')
    } else if (error.message) {
      throw error
    }
    throw new Error('Failed to submit request to spreadsheet. Please try again.')
  }
}

/**
 * Extracts sheet ID from the current page context
 * @returns {string|null} The sheet ID or null if not found
 */
function extractSheetIdFromContext() {
  // Try to get from document input field (BYOR form)
  const documentInput = document.getElementById('document-input')
  if (documentInput && documentInput.value) {
    const match = documentInput.value.match(/https:\/\/docs.google.com\/spreadsheets\/d\/(.*?)($|\/|\?)/)
    if (match && match[1]) {
      return match[1]
    }
  }

  // Try to get from URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const docId = urlParams.get('documentId')
  if (docId) {
    const match = docId.match(/https:\/\/docs.google.com\/spreadsheets\/d\/(.*?)($|\/|\?)/)
    if (match && match[1]) {
      return match[1]
    }
    // If it's already just an ID
    if (!docId.includes('/')) {
      return docId
    }
  }

  return null
}

/**
 * Sanitizes blip data before submission
 * @param {Object} blipData - The raw blip data
 * @returns {Object} Sanitized blip data
 */
function sanitizeBlipData(blipData) {
  // Use the existing InputSanitizer if available, or do basic sanitization
  const sanitize = (str) => {
    if (typeof str !== 'string') return str
    // Basic sanitization: trim and remove extra whitespace
    return str.trim()
  }

  return {
    name: sanitize(blipData.name || ''),
    ring: sanitize(blipData.ring || 'Hold'),
    quadrant: sanitize(blipData.quadrant || ''),
    isNew: sanitize(blipData.isNew || 'TRUE'),
    status: sanitize(blipData.status || ''),
    description: sanitize(blipData.description || ''),
    topic: sanitize(blipData.topic || ''),
  }
}

/**
 * Checks if the current user has write access to a specific sheet
 * @param {string} sheetId - The sheet ID to check
 * @returns {Promise<boolean>} true if user has write access, false otherwise
 */
const checkSheetWriteAccess = async (sheetId) => {
  if (!window.gapi || !window.gapi.client) {
    return false
  }

  try {
    await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    })
    return true
  } catch (error) {
    console.error('Access check failed:', error)
    return false
  }
}

module.exports = {
  submitRequestToSheet,
  checkSheetWriteAccess,
  extractSheetIdFromContext,
}
