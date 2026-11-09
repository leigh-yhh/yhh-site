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

  // DocuSign (legal signing). Paste PowerForm / envelope links when ready.
  // Empty = FSP page shows a clear placeholder CTA until configured.
  docusignServiceAgreementUrl: '',
  docusignDisclosureUrl: '',

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
   *              tenancyApplication | serviceAgreement
   *
   * --- tenancyApplication + Google Drive (ID / docs) ---
   * Site still sends files as base64 under data.files.{licence|passport|otherId|...}:
   *   { name, type, size, base64, docKey, safeFileName, driveFileName }
   * Plus data.driveFolderLabel e.g. "Smith_Jane_2026-10-09".
   * Activepieces Drive steps run after the Worker forwards to the tenancy webhook.
   */
  submitApiUrl: 'https://yhh-submit-proxy.leigh-8cd.workers.dev/api/submit'
};
