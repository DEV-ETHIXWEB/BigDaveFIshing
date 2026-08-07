export const business = {
  name: "Big Dave's Fishing Adventures",
  phone: '(503) 538-5607',
  phoneHref: 'tel:+15035385607',
  email: 'bigdave@bigdavesfishing.com',
  emailHref: 'mailto:bigdave@bigdavesfishing.com',
  address: {
    street: '17175 Wilson River Hwy',
    locality: 'Tillamook',
    region: 'OR',
    postalCode: '97141',
    country: 'USA',
  },
  addressLines: ['17175 Wilson River Hwy,', 'Tillamook, OR 97141, USA'],
  facebook: 'https://www.facebook.com/', // TODO: replace with real Facebook URL
  serviceArea: 'Oregon Coastal Rivers - Wilson, Trask, Kilchis, Tillamook Bay',
  hosts: 'Dave and Leslie Manners',
  // Confirmed from the live site's Rates & Packages page.
  lodgeNightlyRate: '$75 + TAX per person',
};

/**
 * `label` is the full page name - used in the mobile menu, and as the accessible
 * name everywhere. `short` is the condensed form shown in compact chrome.
 *
 * The hrefs are the live site's real slugs, confirmed by fetching
 * bigdavesfishing.com - not guesses. Keeping them identical means the rebuild
 * inherits the existing site's inbound links and search rankings, so they must
 * not be "tidied up" without setting redirects.
 */
export const nav = [
  { label: 'Home', short: 'Home', href: '/' },
  { label: 'Wilson River Lodge', short: 'The Lodge', href: '/wilson-river-lodge' },
  { label: 'Rates & Packages', short: 'Rates', href: '/oregon-rates-packages' },
  { label: 'Oregon Fishing', short: 'Oregon Fishing', href: '/oregon-fishing' },
  { label: 'Video Gallery', short: 'Videos', href: '/videos' },
  { label: 'Fishing Information', short: 'Fish Info', href: '/fishing-information' },
  { label: 'Contact Us/Book Now', short: 'Contact', href: '/contact' },
];

/** Sub-items shown under "Waiver" in the nav, matching the live site's dropdown. */
export const waiverLinks = [
  { label: 'Fishing Adventure Waiver', href: '/waivers/fishing-adventure' },
  { label: 'Wilson River Lodge Waiver', href: '/waivers/lodge' },
];

export const footerLinks = [{ label: 'Waivers', href: '/waivers' }];

/**
 * The tablet/phone nav, grouped into three cards.
 *
 * Three is the component's hard limit, and there are nine destinations, so this is a
 * grouping rather than a list — every one of the nine appears exactly once. Home is
 * deliberately absent: the logo beside the hamburger is the home link, as it is on
 * every page of the live site.
 *
 * Colours are three steps of the same neutral ramp, darkest first, so the stack reads
 * as one object rather than three unrelated tiles.
 */
export const navCards = [
  {
    label: 'Fishing',
    bgColor: '#111111',
    textColor: '#f4f4f4',
    links: [
      { label: 'Oregon Fishing', href: '/oregon-fishing' },
      { label: 'Fishing Information', href: '/fishing-information' },
      { label: 'Rates & Packages', href: '/oregon-rates-packages' },
    ],
  },
  {
    label: 'The Lodge',
    bgColor: '#2a2a2a',
    textColor: '#f4f4f4',
    links: [
      { label: 'Wilson River Lodge', href: '/wilson-river-lodge' },
      { label: 'Video Gallery', href: '/videos' },
    ],
  },
  {
    label: 'Book',
    bgColor: '#4a4a4a',
    textColor: '#ffffff',
    links: [
      { label: 'Contact Us/Book Now', href: '/contact' },
      { label: 'Fishing Adventure Waiver', href: '/waivers/fishing-adventure' },
      { label: 'Lodge Waiver', href: '/waivers/lodge' },
    ],
  },
];

/** The season table from the live Oregon Fishing page, verbatim. */
export const seasons = [
  { fish: 'Spring Chinook', window: 'May and June' },
  { fish: 'Summer Kings', window: 'July and August' },
  { fish: 'Fall Chinook', window: 'mid-September to December' },
  { fish: 'Winter Steelhead', window: 'December to mid-April' },
];
