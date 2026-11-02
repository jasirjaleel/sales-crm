// Business details come from the environment, so no deployment's identity lives in the code.
// The defaults are deliberately plain placeholders, and each deployment sets its own values.
const env = import.meta.env;

export const brand = {
  name: env.VITE_BRAND_NAME || 'Sales CRM',
  website: env.VITE_BRAND_WEBSITE || 'example.com',
  legalName: env.VITE_BRAND_LEGAL_NAME || env.VITE_BRAND_NAME || 'Sales CRM',
  upiId: env.VITE_BRAND_UPI_ID || 'billing@example.com',
  signatory: env.VITE_BRAND_SIGNATORY || 'Account Manager',
};
