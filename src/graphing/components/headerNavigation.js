const d3 = require('d3')
const RequestSubmissionForm = require('./requestSubmissionForm')
const GoogleAuth = require('../../util/googleAuth')

function renderHeaderNavigation(header) {
  // Create a navigation container in the header
  const existingNav = header.querySelector('.header-nav')
  if (existingNav) {
    existingNav.remove()
  }

  const nav = document.createElement('nav')
  nav.className = 'header-nav'

  // Submit request button
  const submitBtn = document.createElement('button')
  submitBtn.className = 'header-nav__submit-btn'
  submitBtn.textContent = 'Submit Request'
  submitBtn.addEventListener('click', openRequestModal)

  nav.appendChild(submitBtn)

  // Add to header
  header.appendChild(nav)

  return submitBtn
}

function openRequestModal() {
  // First, ensure Google API is initialized
  GoogleAuth.loadGoogle(false, () => {
    createAndShowModal()
  })
}

function createAndShowModal() {
  // Create modal overlay
  const existingModal = document.getElementById('request-modal')
  if (existingModal) {
    existingModal.remove()
  }

  const modal = document.createElement('div')
  modal.id = 'request-modal'
  modal.className = 'request-modal'

  const backdrop = document.createElement('div')
  backdrop.className = 'request-modal__backdrop'

  const content = document.createElement('div')
  content.className = 'request-modal__content'

  const header = document.createElement('div')
  header.className = 'request-modal__header'

  const title = document.createElement('h2')
  title.textContent = 'Submit a Technology Request'
  header.appendChild(title)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'request-modal__close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.innerHTML = '&times;'
  closeBtn.addEventListener('click', () => closeRequestModal(modal))

  header.appendChild(closeBtn)

  const formContainer = document.createElement('div')
  formContainer.className = 'request-modal__form-container'

  content.appendChild(header)
  content.appendChild(formContainer)

  modal.appendChild(backdrop)
  modal.appendChild(content)

  document.body.appendChild(modal)

  // Initialize the form in the modal
  const form = RequestSubmissionForm()
  form.attach(formContainer)

  // Close on backdrop click
  backdrop.addEventListener('click', () => closeRequestModal(modal))

  // Close on escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeRequestModal(modal)
      document.removeEventListener('keydown', escapeHandler)
    }
  }
  document.addEventListener('keydown', escapeHandler)

  // Focus trap - keep focus within modal
  const focusableElements = formContainer.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (firstElement) {
    firstElement.focus()
  }

  const focusHandler = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }
  }

  modal.addEventListener('keydown', focusHandler)
}

function closeRequestModal(modal) {
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal)
  }
}

module.exports = {
  renderHeaderNavigation,
  openRequestModal,
  closeRequestModal,
}
