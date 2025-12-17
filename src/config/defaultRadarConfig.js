const getDefaultRadarSheet = () => {
  const sheetId = process.env.DEFAULT_RADAR_SHEET_ID || process.env.DEFAULT_RADAR_SHEET_URL
  const sheetName = process.env.DEFAULT_RADAR_SHEET_NAME || null
  const title = process.env.DEFAULT_RADAR_TITLE || 'Company Tech Radar'

  if (!sheetId) {
    return null
  }

  return {
    sheetId,
    sheetName,
    title,
  }
}

module.exports = {
  getDefaultRadarSheet,
}

