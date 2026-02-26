const { submitRequestToSheet } = require('../../util/sheetAppender')

const RequestSubmissionForm = () => {
  const formHTML = `
    <div class="request-submission-form home-page">
      <h2>Submit a Technology Request</h2>
      <p>Can't find what you're looking for in our radar? Submit a request to add a new technology or tool to the Hold phase.</p>
      <form id="request-submission-form" method="post">
        <div class="form-group">
          <label for="request-sheet-url">Your Radar Sheet URL *</label>
          <input
            type="url"
            id="request-sheet-url"
            name="sheetUrl"
            placeholder="e.g. https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID"
            required
            maxlength="500"
          />
          <span class="form-helper-text">Enter the URL of the Google Sheet you want to submit to</span>
          <span class="form-error" id="error-sheetUrl"></span>
        </div>

        <div class="form-group">
          <label for="request-name">Technology Name *</label>
          <input
            type="text"
            id="request-name"
            name="name"
            placeholder="e.g. Kubernetes, React, Python"
            required
            maxlength="255"
          />
          <span class="form-error" id="error-name"></span>
        </div>

        <div class="form-group">
          <label for="request-quadrant">Quadrant *</label>
          <select id="request-quadrant" name="quadrant" required>
            <option value="">Select a quadrant...</option>
            <option value="Creative">Creative</option>
            <option value="Digital">Digital</option>
            <option value="PR & Content">PR & Content</option>
            <option value="CS & Operations">CS & Operations</option>
          </select>
          <span class="form-error" id="error-quadrant"></span>
        </div>

        <div class="form-group">
          <label for="request-description">Description *</label>
          <textarea
            id="request-description"
            name="description"
            placeholder="Describe what this technology is and why it should be considered"
            required
            rows="5"
            maxlength="2000"
          ></textarea>
          <span class="form-helper-text">Max 2000 characters</span>
          <span class="form-error" id="error-description"></span>
        </div>

        <div class="form-group">
          <label for="request-topic">Topic (Optional)</label>
          <input
            type="text"
            id="request-topic"
            name="topic"
            placeholder="e.g. DevOps, Frontend, Backend"
            maxlength="255"
          />
          <span class="form-error" id="error-topic"></span>
        </div>

        <div class="form-info">
          <p><strong>Note:</strong> Submissions are automatically assigned to the <strong>Hold</strong> phase for review and evaluation.</p>
        </div>

        <div class="form-actions">
          <button type="submit" class="form-submit-btn">Submit Request</button>
          <button type="reset" class="form-reset-btn">Clear Form</button>
        </div>

        <div id="submission-message" class="submission-message"></div>
      </form>
    </div>
  `

  return {
    render() {
      return formHTML
    },

    attach(domNode) {
      if (!domNode) return

      domNode.innerHTML = this.render()

      const form = domNode.querySelector('#request-submission-form')
      if (!form) return

      form.addEventListener('submit', (e) => this.handleSubmit(e, domNode))
    },

    async handleSubmit(event, formContainer) {
      event.preventDefault()

      const form = event.target
      const formData = new FormData(form)

      // Clear previous messages
      const messageEl = formContainer.querySelector('#submission-message')
      messageEl.innerHTML = ''
      messageEl.className = 'submission-message'

      // Validate fields
      const validationErrors = this.validateForm(formData)
      if (validationErrors.length > 0) {
        this.displayValidationErrors(formContainer, validationErrors)
        return
      }

      // Get submit button and store original text
      const submitBtn = form.querySelector('[type="submit"]')
      const originalText = submitBtn.textContent

      try {
        // Show loading state
        submitBtn.disabled = true
        submitBtn.textContent = 'Submitting...'

        // Prepare data for submission (ring defaults to "Hold")
        const submissionData = {
          name: formData.get('name'),
          quadrant: formData.get('quadrant'),
          description: formData.get('description'),
          topic: formData.get('topic') || '',
          ring: 'Hold',
          isNew: 'TRUE',
        }

        // Extract sheet ID from URL
        const sheetUrl = formData.get('sheetUrl')
        const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
        const sheetId = sheetIdMatch ? sheetIdMatch[1] : null

        if (!sheetId) {
          throw new Error('Unable to extract Sheet ID from URL. Please check the URL format.')
        }

        // Submit to sheet
        await submitRequestToSheet(submissionData, sheetId)

        // Success message
        messageEl.className = 'submission-message success'
        messageEl.innerHTML = `
          <p class="message-content">
            ✓ Your request has been submitted successfully! It has been added to the Hold phase for review.
          </p>
        `

        // Reset form
        form.reset()

        // Hide message after 5 seconds
        setTimeout(() => {
          messageEl.innerHTML = ''
        }, 5000)
      } catch (error) {
        console.error('Submission error:', error)
        messageEl.className = 'submission-message error'
        messageEl.innerHTML = `
          <p class="message-content">
            ✗ Error submitting your request: ${error.message}
          </p>
          <p class="message-subtext">Please try again or contact support if the problem persists.</p>
        `
      } finally {
        submitBtn.disabled = false
        submitBtn.textContent = originalText
      }
    },

    validateForm(formData) {
      const errors = []
      const sheetUrl = formData.get('sheetUrl')?.trim()
      const name = formData.get('name')?.trim()
      const quadrant = formData.get('quadrant')?.trim()
      const description = formData.get('description')?.trim()

      if (!sheetUrl || sheetUrl.length === 0) {
        errors.push({ field: 'sheetUrl', message: 'Sheet URL is required' })
      } else if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
        errors.push({ field: 'sheetUrl', message: 'Please enter a valid Google Sheets URL' })
      }

      if (!name || name.length === 0) {
        errors.push({ field: 'name', message: 'Technology name is required' })
      }

      if (!quadrant || quadrant.length === 0) {
        errors.push({ field: 'quadrant', message: 'Quadrant selection is required' })
      }

      if (!description || description.length === 0) {
        errors.push({ field: 'description', message: 'Description is required' })
      } else if (description.length < 10) {
        errors.push({ field: 'description', message: 'Description must be at least 10 characters' })
      }

      return errors
    },

    displayValidationErrors(formContainer, errors) {
      // Clear all previous error messages
      formContainer.querySelectorAll('.form-error').forEach((el) => {
        el.textContent = ''
      })

      // Display new errors
      errors.forEach(({ field, message }) => {
        const errorEl = formContainer.querySelector(`#error-${field}`)
        if (errorEl) {
          errorEl.textContent = message
        }
      })

      // Show error message
      const messageEl = formContainer.querySelector('#submission-message')
      messageEl.className = 'submission-message error'
      messageEl.innerHTML = '<p class="message-content">Please correct the errors below and try again.</p>'
    },
  }
}

module.exports = RequestSubmissionForm
