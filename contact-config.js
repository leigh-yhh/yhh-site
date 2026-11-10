/**
 * Your Home Hunter - Contact & Scheduling Configuration
 * Manage your Google Workspace Appointment Scheduling links and WhatsApp details here.
 */
window.YHH_CONTACT_CONFIG = {
  // Google Workspace Appointment Scheduling (10-15 Min Discovery Call)
  // Replace with your Google Calendar Appointment Schedule link
  // e.g., 'https://calendar.app.google/YourScheduleId' or 'https://calendar.google.com/calendar/u/0/appointments/schedules/...'
  googleAppointmentsIntroUrl: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2_cMxdfUojr153utSiTOByBuvddRpqBLdrqxksB8MPqO4UYEFzoJAKf0pyiJb2e_fZn0DvDBsC',

  // Google Workspace Appointment Scheduling (60-Min Paid Tenancy Consultation — Brit)
  googleAppointmentsConsultUrl: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2_cMxdfUojr153utSiTOByBuvddRpqBLdrqxksB8MPqO4UYEFzoJAKf0pyiJb2e_fZn0DvDBsC',

  // WhatsApp Direct Mobile / Business Number
  // Format: International format without leading '+' or spaces (e.g. Australian 0412 345 678 -> '61412345678')
  whatsappNumber: '61468380944',
  whatsappDisplayNumber: 'Your Home Hunter',

  // Pre-filled WhatsApp greeting messages
  whatsappMessageGeneral: "Hi Your Home Hunter, I would like to ask a question about your rental advocacy services.",
  whatsappMessageConsult: "Hi Your Home Hunter, I have booked a tenancy consultation and would like to connect.",

  // Standard Phone & Email
  phone: '1800 666 944',
  phoneRaw: '1800666944',
  email: 'info@yourhomehunter.com.au',

  // Google Places API Key (Live Street Address Autocomplete)
  // Optional: Leave empty to use free street suggestions + the built-in AU suburb list.
  // When set, address fields upgrade to Google Places (AU street-level) and selecting
  // an address also fills suburb/postcode in the same address group.
  googlePlacesApiKey: '',

  // Google Analytics 4 Measurement ID (Admin → Data streams → Web → Measurement ID)
  // Example: 'G-XXXXXXXXXX'  Leave empty to disable tracking.
  googleAnalyticsId: 'G-VK72HM8677',

  // Stripe Payment Link — Full Service engagement fee ($1,100)
  stripeEngagementFeeUrl: 'https://buy.stripe.com/7sY28k9GE6JvgaS6yM4ZG02',

  // Legal signing links. Empty = FSP page shows a placeholder CTA until configured.
  docusignServiceAgreementUrl: 'https://forms.zohopublic.com.au/YHH/form/ServiceAgreement/formperma/ZetJPTQZ7wOIrLKHNqTl9Gsj7o7a-5bJRqK8NUqvrwI',
  docusignDisclosureUrl: 'https://forms.zohopublic.com.au/YHH/form/DisclosureandDeclarationStatement/formperma/FsgIdHKX9yXKEt_yIpZ-5k8tILjox4LZ0lmvx_FL0lw',

  /**
   * Cloudflare Worker submit proxy (hides Activepieces webhook URLs from the browser).
   * Deploy: workers/submit-proxy (see README there). Set secrets with wrangler secret put.
   *
   * Examples:
   *   'https://yhh-submit-proxy.<your-subdomain>.workers.dev/api/submit'
   *   'https://www.yourhomehunter.com.au/api/submit'  (after custom route)
   * Leave empty to skip network submit (local success UI still works).
   *
   * Browser POSTs: { flow, data, pageUrl }
   * flow values: wishlist | introCall | consult | inspector | inspectionBooking |
   *              tenancyApplication | tenancyApplicationFiles | serviceAgreement
   *
   * --- tenancyApplication (split submit) ---
   * 1) tenancyApplication — nested form JSON (+ submissionId, fileCount)
   * 2) tenancyApplicationFiles — one file per request ({ applicant, file: { base64, docKey, … } })
   * Activepieces Google Drive connection writes files into folder label / parent folder.
   */
  submitApiUrl: 'https://yhh-submit-proxy.leigh-8cd.workers.dev/api/submit'
};
