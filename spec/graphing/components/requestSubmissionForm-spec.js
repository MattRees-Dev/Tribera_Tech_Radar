const RequestSubmissionForm = require('../../src/graphing/components/requestSubmissionForm')

describe('RequestSubmissionForm', () => {
  let formComponent
  let container

  beforeEach(() => {
    formComponent = RequestSubmissionForm()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('Form Rendering', () => {
    it('should render the form with all required fields', () => {
      formComponent.attach(container)

      expect(container.querySelector('#request-sheet-url')).toBeTruthy()
      expect(container.querySelector('#request-name')).toBeTruthy()
      expect(container.querySelector('#request-quadrant')).toBeTruthy()
      expect(container.querySelector('#request-description')).toBeTruthy()
      expect(container.querySelector('#request-topic')).toBeTruthy()
    })

    it('should render form with correct quadrant options', () => {
      formComponent.attach(container)

      const quadrantSelect = container.querySelector('#request-quadrant')
      const options = Array.from(quadrantSelect.options).map((o) => o.value)

      expect(options).toContain('Creative')
      expect(options).toContain('Digital')
      expect(options).toContain('PR & Content')
      expect(options).toContain('CS & Operations')
    })

    it('should have a submit button', () => {
      formComponent.attach(container)

      const submitBtn = container.querySelector('[type="submit"]')
      expect(submitBtn).toBeTruthy()
      expect(submitBtn.textContent).toContain('Submit Request')
    })

    it('should have a reset button', () => {
      formComponent.attach(container)

      const resetBtn = container.querySelector('[type="reset"]')
      expect(resetBtn).toBeTruthy()
    })
  })

  describe('Form Validation', () => {
    it('should validate sheet URL is required', () => {
      formComponent.attach(container)

      const formData = new FormData()
      formData.append('sheetUrl', '')
      formData.append('name', 'Test')
      formData.append('quadrant', 'Creative')
      formData.append('description', 'This is a valid description')

      const errors = formComponent.validateForm(formData)
      expect(errors.some((e) => e.field === 'sheetUrl')).toBe(true)
    })

    it('should validate sheet URL format', () => {
      formComponent.attach(container)

      const formData = new FormData()
      formData.append('sheetUrl', 'https://example.com/invalid')
      formData.append('name', 'Test')
      formData.append('quadrant', 'Creative')
      formData.append('description', 'This is a valid description')

      const errors = formComponent.validateForm(formData)
      expect(errors.some((e) => e.field === 'sheetUrl')).toBe(true)
    })

    it('should validate required fields', () => {
      formComponent.attach(container)

      const formData = new FormData()
      formData.append('sheetUrl', 'https://docs.google.com/spreadsheets/d/test123')
      formData.append('name', '')
      formData.append('quadrant', '')
      formData.append('description', '')

      const errors = formComponent.validateForm(formData)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.field === 'name')).toBe(true)
      expect(errors.some((e) => e.field === 'quadrant')).toBe(true)
      expect(errors.some((e) => e.field === 'description')).toBe(true)
    })

    it('should validate minimum description length', () => {
      formComponent.attach(container)

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('quadrant', 'Creative')
      formData.append('description', 'short')

      const errors = formComponent.validateForm(formData)
      expect(errors.some((e) => e.field === 'description')).toBe(true)
    })

    it('should accept valid form data', () => {
      formComponent.attach(container)

      const formData = new FormData()
      formData.append('sheetUrl', 'https://docs.google.com/spreadsheets/d/test123abc')
      formData.append('name', 'Test Technology')
      formData.append('quadrant', 'Creative')
      formData.append('description', 'This is a valid description with sufficient length')
      formData.append('topic', 'Testing')

      const errors = formComponent.validateForm(formData)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Error Display', () => {
    it('should display validation errors', () => {
      formComponent.attach(container)

      const errors = [
        { field: 'name', message: 'Technology name is required' },
        { field: 'quadrant', message: 'Quadrant selection is required' },
      ]

      formComponent.displayValidationErrors(container, errors)

      const nameError = container.querySelector('#error-name')
      const quadrantError = container.querySelector('#error-quadrant')

      expect(nameError.textContent).toContain('Technology name is required')
      expect(quadrantError.textContent).toContain('Quadrant selection is required')
    })

    it('should clear error messages', () => {
      formComponent.attach(container)

      const errors = [{ field: 'name', message: 'Error message' }]
      formComponent.displayValidationErrors(container, errors)

      const errorEl = container.querySelector('#error-name')
      expect(errorEl.textContent).not.toBe('')

      formComponent.displayValidationErrors(container, [])
      expect(errorEl.textContent).toBe('')
    })
  })

  describe('Form Reset', () => {
    it('should clear form fields on reset', () => {
      formComponent.attach(container)

      const nameInput = container.querySelector('#request-name')
      const form = container.querySelector('#request-submission-form')

      nameInput.value = 'Test'
      expect(nameInput.value).toBe('Test')

      const resetBtn = container.querySelector('[type="reset"]')
      resetBtn.click()

      expect(form.elements.name.value).toBe('')
    })
  })
})
