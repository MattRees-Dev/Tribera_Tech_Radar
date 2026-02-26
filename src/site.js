require('./common')
require('./images/logo.png')
require('./images/radar_legend.png')
require('./analytics.js')

const Factory = require('./util/factory')
const { renderHeaderNavigation } = require('./graphing/components/headerNavigation')

// Initialize header navigation
window.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header.input-sheet__logo')
  if (header) {
    renderHeaderNavigation(header)
  }
})

Factory().build()
