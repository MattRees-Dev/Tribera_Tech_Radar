/* eslint no-constant-condition: "off" */

const d3 = require('d3')
const _ = {
  map: require('lodash/map'),
  uniqBy: require('lodash/uniqBy'),
  each: require('lodash/each'),
}

const InputSanitizer = require('./inputSanitizer')
const Radar = require('../models/radar')
const Quadrant = require('../models/quadrant')
const Ring = require('../models/ring')
const Blip = require('../models/blip')
const GraphingRadar = require('../graphing/radar')
const MalformedDataError = require('../exceptions/malformedDataError')
const SheetNotFoundError = require('../exceptions/sheetNotFoundError')
const ContentValidator = require('./contentValidator')
const Sheet = require('./sheet')
const ExceptionMessages = require('./exceptionMessages')
const GoogleAuth = require('./googleAuth')
const config = require('../config')
const featureToggles = config().featureToggles
const { getDefaultRadarSheet } = require('../config/defaultRadarConfig')
const { companyName, companyUrl } = require('../config/brandingConfig')
const { getDocumentOrSheetId, getSheetName } = require('./urlUtils')
const { getGraphSize, graphConfig, isValidConfig } = require('../graphing/config')
const InvalidConfigError = require('../exceptions/invalidConfigError')
const InvalidContentError = require('../exceptions/invalidContentError')
const FileNotFoundError = require('../exceptions/fileNotFoundError')
const plotRadar = function (title, blips, currentRadarName, alternativeRadars) {
  if (title.endsWith('.csv')) {
    title = title.substring(0, title.length - 4)
  }
  if (title.endsWith('.json')) {
    title = title.substring(0, title.length - 5)
  }
  document.title = title
  d3.selectAll('.loading').remove()

  var rings = _.map(_.uniqBy(blips, 'ring'), 'ring')
  var ringMap = {}
  var maxRings = 4

  _.each(rings, function (ringName, i) {
    if (i === maxRings) {
      throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS)
    }
    ringMap[ringName] = new Ring(ringName, i)
  })

  var quadrants = {}
  _.each(blips, function (blip) {
    if (!quadrants[blip.quadrant]) {
      quadrants[blip.quadrant] = new Quadrant(blip.quadrant[0].toUpperCase() + blip.quadrant.slice(1))
    }
    quadrants[blip.quadrant].add(
      new Blip(
        blip.name,
        ringMap[blip.ring],
        blip.isNew.toLowerCase() === 'true',
        blip.status,
        blip.topic,
        blip.description,
      ),
    )
  })

  var radar = new Radar()
  _.each(quadrants, function (quadrant) {
    radar.addQuadrant(quadrant)
  })

  if (alternativeRadars !== undefined || true) {
    alternativeRadars.forEach(function (sheetName) {
      radar.addAlternative(sheetName)
    })
  }

  if (currentRadarName !== undefined || true) {
    radar.setCurrentSheet(currentRadarName)
  }

  const size = featureToggles.UIRefresh2022
    ? getGraphSize()
    : window.innerHeight - 133 < 620
    ? 620
    : window.innerHeight - 133
  new GraphingRadar(size, radar).init().plot()
}

function validateInputQuadrantOrRingName(allQuadrantsOrRings, quadrantOrRing) {
  const quadrantOrRingNames = Object.keys(allQuadrantsOrRings)
  const regexToFixLanguagesAndFrameworks = /(-|\s+)(and)(-|\s+)|\s*(&)\s*/g
  const formattedInputQuadrant = quadrantOrRing.toLowerCase().replace(regexToFixLanguagesAndFrameworks, ' & ')
  return quadrantOrRingNames.find((quadrantOrRing) => quadrantOrRing.toLowerCase() === formattedInputQuadrant)
}

const plotRadarGraph = function (title, blips, currentRadarName, alternativeRadars) {
  document.title = title.replace(/.(csv|json)$/, '')

  d3.selectAll('.loading').remove()

  const ringMap = graphConfig.rings.reduce((allRings, ring, index) => {
    allRings[ring] = new Ring(ring, index)
    return allRings
  }, {})

  const quadrants = graphConfig.quadrants.reduce((allQuadrants, quadrant) => {
    allQuadrants[quadrant] = new Quadrant(quadrant)
    return allQuadrants
  }, {})

  blips.forEach((blip) => {
    const currentQuadrant = validateInputQuadrantOrRingName(quadrants, blip.quadrant)
    const ring = validateInputQuadrantOrRingName(ringMap, blip.ring)
    if (currentQuadrant && ring) {
      const blipObj = new Blip(
        blip.name,
        ringMap[ring],
        blip.isNew.toLowerCase() === 'true',
        blip.status,
        blip.topic,
        blip.description,
      )
      quadrants[currentQuadrant].add(blipObj)
    }
  })

  const radar = new Radar()
  radar.addRings(Object.values(ringMap))

  _.each(quadrants, function (quadrant) {
    radar.addQuadrant(quadrant)
  })

  alternativeRadars.forEach(function (sheetName) {
    radar.addAlternative(sheetName)
  })

  radar.setCurrentSheet(currentRadarName)

  const graphSize = window.innerHeight - 133 < 620 ? 620 : window.innerHeight - 133
  const size = featureToggles.UIRefresh2022 ? getGraphSize() : graphSize
  new GraphingRadar(size, radar).init().plot()
}

const CSVDocument = function (url) {
  var self = {}

  self.build = function () {
    d3.csv(url)
      .then(createBlips)
      .catch((exception) => {
        const fileNotFoundError = new FileNotFoundError(`Oops! We can't find the CSV file you've entered`)
        plotErrorMessage(featureToggles.UIRefresh2022 ? fileNotFoundError : exception, 'csv')
      })
  }

  var createBlips = function (data) {
    try {
      // Debug: log parsed CSV columns and sample rows to help diagnose invalid CSV issues
      try {
        // Some CSVs may not have `columns` set; guard the log to avoid errors
        // eslint-disable-next-line no-console
        console.log('[BYOR] Parsed CSV columns:', data.columns)
        // eslint-disable-next-line no-console
        console.log('[BYOR] Parsed CSV first rows sample:', data.slice ? data.slice(0, 3) : data)
      } catch (e) {
        // ignore logging errors
      }

      // Remap malformed header key (e.g., '\\' or backslash) to 'name'
      if (data && data.length > 0) {
        const firstRow = data[0]
        const keys = Object.keys(firstRow)
        // Look for a key that looks like a malformed/escaped character and remap it to 'name'
        const badKey = keys.find((k) => k === '\\' || k === '\\\\' || (k.length <= 2 && /[\\/"'`]/.test(k)))
        if (badKey && !firstRow.name) {
          // Remap all rows: copy badKey value to 'name' key
          data = data.map(function (row) {
            const newRow = {}
            Object.keys(row).forEach(function (key) {
              if (key === badKey) {
                newRow.name = row[key]
              } else {
                newRow[key] = row[key]
              }
            })
            return newRow
          })
        }
      }

      // Use actual data row keys as column names
      columnNames = []
      if (data && data.length > 0) {
        columnNames = Object.keys(data[0])
      }
      // Pass column names directly to ContentValidator (it will trim them)
      delete data.columns
      var contentValidator = new ContentValidator(columnNames)
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
      var blips = _.map(data, new InputSanitizer().sanitize)
      featureToggles.UIRefresh2022
        ? plotRadarGraph(FileName(url), blips, 'CSV File', [])
        : plotRadar(FileName(url), blips, 'CSV File', [])
    } catch (exception) {
      // Build a more helpful invalid content error including parsed headers and a sample of rows
      try {
        const sample = (data && data.slice ? data.slice(0, 3) : data) || []
        const headerInfo = (Array.isArray(columnNames) ? columnNames : []).join(', ')
        const details = ` Parsed headers: ${headerInfo}. Sample rows: ${JSON.stringify(sample)}`
        const invalidContentError = new InvalidContentError(ExceptionMessages.INVALID_CSV_CONTENT + details)
        plotErrorMessage(featureToggles.UIRefresh2022 ? invalidContentError : exception, 'csv')
      } catch (e) {
        const invalidContentError = new InvalidContentError(ExceptionMessages.INVALID_CSV_CONTENT)
        plotErrorMessage(featureToggles.UIRefresh2022 ? invalidContentError : exception, 'csv')
      }
    }
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const GoogleSheet = function (sheetReference, sheetName) {
  var self = {}

  self.build = function () {
    const apiKeyEnabled = process.env.API_KEY || false
    // If no API_KEY is set, try using CSV export URL (works for public sheets without API key)
    if (!apiKeyEnabled) {
      const sheet = new Sheet(sheetReference)
      const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=0`
      // Fallback to CSV loading for public sheets
      const csvSheet = CSVDocument(csvExportUrl)
      csvSheet.init().build()
      return
    }
    self.authenticate(false, apiKeyEnabled)
  }

  function createBlipsForProtectedSheet(documentTitle, values, sheetNames) {
    if (!sheetName) {
      sheetName = sheetNames[0]
    }
    values.forEach(function () {
      var contentValidator = new ContentValidator(values[0])
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
    })

    const all = values
    const header = all.shift()
    var blips = _.map(all, (blip) => new InputSanitizer().sanitizeForProtectedSheet(blip, header))
    const title = featureToggles.UIRefresh2022 ? documentTitle : documentTitle + ' - ' + sheetName
    featureToggles.UIRefresh2022
      ? plotRadarGraph(title, blips, sheetName, sheetNames)
      : plotRadar(title, blips, sheetName, sheetNames)
  }

  self.authenticate = function (force = false, apiKeyEnabled, callback) {
    GoogleAuth.loadGoogle(force, async function () {
      self.error = false
      const sheet = new Sheet(sheetReference)
      await sheet.getSheet()
      if (sheet.sheetResponse.status === 403 && !GoogleAuth.gsiInitiated && !force) {
        // private sheet
        GoogleAuth.loadGSI()
      } else {
        await sheet.processSheetResponse(sheetName, createBlipsForProtectedSheet, (error) => {
          if (error.status === 403) {
            self.error = true
            plotUnauthorizedErrorMessage()
          } else if (error instanceof MalformedDataError) {
            plotErrorMessage(error, 'sheet')
          } else {
            plotErrorMessage(sheet.createSheetNotFoundError(), 'sheet')
          }
        })
        if (callback) {
          callback()
        }
      }
    })
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const JSONFile = function (url) {
  var self = {}

  self.build = function () {
    d3.json(url)
      .then(createBlips)
      .catch((exception) => {
        const fileNotFoundError = new FileNotFoundError(`Oops! We can't find the JSON file you've entered`)
        plotErrorMessage(featureToggles.UIRefresh2022 ? fileNotFoundError : exception, 'json')
      })
  }

  var createBlips = function (data) {
    try {
      var columnNames = Object.keys(data[0])
      var contentValidator = new ContentValidator(columnNames)
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
      var blips = _.map(data, new InputSanitizer().sanitize)
      featureToggles.UIRefresh2022
        ? plotRadarGraph(FileName(url), blips, 'JSON File', [])
        : plotRadar(FileName(url), blips, 'JSON File', [])
    } catch (exception) {
      const invalidContentError = new InvalidContentError(ExceptionMessages.INVALID_JSON_CONTENT)
      plotErrorMessage(featureToggles.UIRefresh2022 ? invalidContentError : exception, 'json')
    }
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const DomainName = function (url) {
  var search = /.+:\/\/([^\\/]+)/
  var match = search.exec(decodeURIComponent(url.replace(/\+/g, ' ')))
  return match == null ? null : match[1]
}

const FileName = function (url) {
  var search = /([^\\/]+)$/
  var match = search.exec(decodeURIComponent(url.replace(/\+/g, ' ')))
  if (match != null) {
    return match[1]
  }
  return url
}

const Factory = function () {
  var self = {}
  var sheet

  self.build = function () {
    if (!isValidConfig()) {
      plotError(new InvalidConfigError(ExceptionMessages.INVALID_CONFIG))
      return
    }

    window.addEventListener('keydown', function (e) {
      if (featureToggles.UIRefresh2022 && e.key === '/') {
        const inputElement =
          d3.select('input.search-container__input').node() || d3.select('.input-sheet-form input').node()

        if (document.activeElement !== inputElement) {
          e.preventDefault()
          inputElement.focus()
          inputElement.scrollIntoView({
            behavior: 'smooth',
          })
        }
      }
    })

    const domainName = DomainName(window.location.search.substring(1))
    const paramId = getDocumentOrSheetId()

    if (paramId && paramId.endsWith('.csv')) {
      sheet = CSVDocument(paramId)
      sheet.init().build()
    } else if (paramId && paramId.endsWith('.json')) {
      sheet = JSONFile(paramId)
      sheet.init().build()
    } else if (domainName && domainName.endsWith('google.com') && paramId) {
      const sheetName = getSheetName()
      sheet = GoogleSheet(paramId, sheetName)
      sheet.init().build()
    } else {
      const defaultRadarSheet = getDefaultRadarSheet()
      if (defaultRadarSheet && defaultRadarSheet.sheetId) {
        sheet = GoogleSheet(defaultRadarSheet.sheetId, defaultRadarSheet.sheetName)
        sheet.init().build()
        return
      }
      if (!featureToggles.UIRefresh2022) {
        document.body.style.opacity = '1'
        document.body.innerHTML = ''
        const content = d3.select('body').append('div').attr('class', 'input-sheet')
        plotLogo(content)
        const bannerText =
          '<div><h1>Build your own radar</h1><p>Once you\'ve <a href ="https://www.thoughtworks.com/radar/byor">created your Radar</a>, you can use this service' +
          ' to generate an <br />interactive version of your Technology Radar. Not sure how? <a href ="https://www.thoughtworks.com/radar/byor">Read this first.</a></p></div>'

        plotBanner(content, bannerText)

        plotForm(content)

        plotFooter(content)
      }

      setDocumentTitle()
    }
  }

  return self
}

function setDocumentTitle() {
  const defaultRadarSheet = getDefaultRadarSheet()
  document.title = (defaultRadarSheet && defaultRadarSheet.title) || 'Company Tech Radar'
}

function plotLoading(content) {
  if (!featureToggles.UIRefresh2022) {
    document.body.style.opacity = '1'
    document.body.innerHTML = ''
    content = d3.select('body').append('div').attr('class', 'loading').append('div').attr('class', 'input-sheet')

    setDocumentTitle()

    plotLogo(content)

    var bannerText =
      '<h1>Building your radar...</h1><p>Your Technology Radar will be available in just a few seconds</p>'
    plotBanner(content, bannerText)
    plotFooter(content)
  } else {
    document.querySelector('.helper-description > p').style.display = 'none'
    document.querySelector('.input-sheet-form').style.display = 'none'
    document.querySelector('.helper-description .loader-text').style.display = 'block'
  }
}

function plotLogo(content) {
  content
    .append('div')
    .attr('class', 'input-sheet__logo')
    .html('<a href="' + companyUrl + '"><img src="/images/tw-logo.png" alt="' + companyName + ' logo"/ ></a>')
}

function plotFooter(content) {
  content
    .append('div')
    .attr('id', 'footer')
    .append('div')
    .attr('class', 'footer-content')
    .append('p')
    .html(
      'Powered by <a href="' +
        companyUrl +
        '"> ' +
        companyName +
        '</a>. ' +
        'Based on the open source project <a href="https://github.com/thoughtworks/build-your-own-radar">Build Your Own Radar</a>.',
    )
}

function plotBanner(content, text) {
  content.append('div').attr('class', 'input-sheet__banner').html(text)
}

function plotForm(content) {
  content
    .append('div')
    .attr('class', 'input-sheet__form')
    .append('p')
    .html(
      '<strong>Enter the URL of your <a href="https://www.thoughtworks.com/radar/byor" target="_blank">Google Sheet, CSV or JSON</a> file below…</strong>',
    )

  var form = content.select('.input-sheet__form').append('form').attr('method', 'get')

  form
    .append('input')
    .attr('type', 'text')
    .attr('name', 'sheetId')
    .attr('placeholder', 'e.g. https://docs.google.com/spreadsheets/d/<sheetid> or hosted CSV/JSON file')
    .attr('required', '')

  form.append('button').attr('type', 'submit').append('a').attr('class', 'button').text('Build my radar')

  form.append('p').html("<a href='https://www.thoughtworks.com/radar/byor#guide'>Need help?</a>")
}

function plotErrorMessage(exception, fileType) {
  if (featureToggles.UIRefresh2022) {
    showErrorMessage(exception, fileType)
  } else {
    const content = d3.select('body').append('div').attr('class', 'input-sheet')
    setDocumentTitle()

    plotLogo(content)

    const bannerText =
      '<div><h1>Build your own radar</h1><p>Once you\'ve <a href ="https://www.thoughtworks.com/radar/byor">created your Radar</a>, you can use this service' +
      ' to generate an <br />interactive version of your Technology Radar. Not sure how? <a href ="https://www.thoughtworks.com/radar/byor">Read this first.</a></p></div>'

    plotBanner(content, bannerText)

    d3.selectAll('.loading').remove()
    plotError(exception, fileType)

    plotFooter(content)
  }
}

function plotError(exception, fileType) {
  let message
  let faqMessage = 'Please check <a href="https://www.thoughtworks.com/radar/byor">FAQs</a> for possible solutions.'
  if (featureToggles.UIRefresh2022) {
    message = exception.message
    if (exception instanceof SheetNotFoundError) {
      const href = 'https://www.thoughtworks.com/radar/byor'
      faqMessage = `You can also check the <a href="${href}">FAQs</a> for other possible solutions`
    }
    if (exception instanceof InvalidConfigError) {
      faqMessage = ''
      d3.selectAll('.input-sheet-form form input').attr('disabled', true)
    }
  } else {
    const fileTypes = { sheet: 'Google Sheet', json: 'JSON file', csv: 'CSV file' }
    const file = fileTypes[fileType]
    message = `Oops! We can't find the ${file} you've entered`
    if (exception instanceof MalformedDataError) {
      message = message.concat(exception.message)
    }
  }

  d3.selectAll('.error-container__message').remove()
  const container = d3.select('#error-container')

  const errorContainer = container.append('div').attr('class', 'error-container__message')
  errorContainer.append('p').html(message)
  errorContainer.append('p').html(faqMessage)
  d3.select('.input-sheet-form.home-page p').attr('class', 'with-error')

  document.querySelector('.helper-description > p').style.display = 'block'
  document.querySelector('.input-sheet-form').style.display = 'block'

  if (!featureToggles.UIRefresh2022) {
    let homePageURL = window.location.protocol + '//' + window.location.hostname
    homePageURL += window.location.port === '' ? '' : ':' + window.location.port
    const homePage = '<a href=' + homePageURL + '>GO BACK</a>'
    errorContainer.append('div').append('p').html(homePage)
  }
}

function showErrorMessage(exception, fileType) {
  document.querySelector('.helper-description .loader-text').style.display = 'none'
  plotError(exception, fileType)
}

function plotUnauthorizedErrorMessage() {
  let content
  const helperDescription = d3.select('.helper-description')
  if (!featureToggles.UIRefresh2022) {
    content = d3.select('body').append('div').attr('class', 'input-sheet')
    setDocumentTitle()

    plotLogo(content)

    const bannerText = '<div><h1>Build your own radar</h1></div>'

    plotBanner(content, bannerText)

    d3.selectAll('.loading').remove()
  } else {
    content = d3.select('main')
    helperDescription.style('display', 'none')
    d3.selectAll('.loader-text').remove()
    d3.selectAll('.error-container').remove()
  }
  const currentUser = GoogleAuth.getEmail()
  let homePageURL = window.location.protocol + '//' + window.location.hostname
  homePageURL += window.location.port === '' ? '' : ':' + window.location.port
  const goBack = '<a href=' + homePageURL + '>GO BACK</a>'
  const message = `<strong>Oops!</strong> Looks like you are accessing this sheet using <b>${currentUser}</b>, which does not have permission.Try switching to another account.`

  const container = content.append('div').attr('class', 'error-container')

  const errorContainer = container.append('div').attr('class', 'error-container__message')

  errorContainer.append('div').append('p').attr('class', 'error-title').html(message)
  const newUi = featureToggles.UIRefresh2022 ? 'switch-account-button-newui' : 'switch-account-button'
  const button = errorContainer.append('button').attr('class', `button ${newUi}`).text('Switch account')

  errorContainer
    .append('div')
    .append('p')
    .attr('class', 'error-subtitle')
    .html(`or ${goBack} to try a different sheet.`)

  button.on('click', () => {
    let sheet
    sheet = GoogleSheet(getDocumentOrSheetId(), getSheetName())

    sheet.authenticate(true, false, () => {
      if (featureToggles.UIRefresh2022 && !sheet.error) {
        helperDescription.style('display', 'block')
        errorContainer.remove()
      } else if (featureToggles.UIRefresh2022 && sheet.error) {
        helperDescription.style('display', 'none')
      } else {
        content.remove()
      }
    })
  })
}

module.exports = Factory
