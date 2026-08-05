export const business = {
  name: "Big Dave's Fishing Adventures",
  phone: '(503) 538-5607',
  phoneHref: 'tel:+15035385607',
  facebook: 'https://www.facebook.com/', // TODO: replace with real Facebook URL
  serviceArea: 'Oregon Coastal Rivers - Wilson, Trask, Nestucca, Tillamook Bay',
};

/**
 * `label` is the full page name - used in the mobile menu, and as the accessible
 * name everywhere. `short` is the condensed form shown in the desktop bar, which
 * has to fit seven items on one row alongside the logo and the booking button.
 * The URLs are the ones the brief requires us to preserve, so they never change.
 */
export const nav = [
  { label: 'Home', short: 'Home', href: '/' },
  { label: 'Wilson River Lodge', short: 'The Lodge', href: '/wilson-river-lodge' },
  { label: 'Rates & Packages', short: 'Rates', href: '/rates-packages' },
  { label: 'Oregon Fishing', short: 'Oregon Fishing', href: '/oregon-fishing' },
  { label: 'Video Gallery', short: 'Gallery', href: '/video-gallery' },
  { label: 'Fishing Information', short: 'Trip Info', href: '/fishing-information' },
  { label: 'Contact', short: 'Contact', href: '/contact' },
];

export const footerLinks = [{ label: 'Waivers', href: '/waivers' }];
