/**
 * The two liability agreements, copied verbatim from the client's own live site.
 *
 * Source: the WordPress REST API for /fishing-adventure-waiver/ and
 * /wilson-river-lodge-waiver/. Extracted programmatically rather than retyped, because
 * this is legal wording and a transcription slip there is not a cosmetic bug.
 *
 * These replace the SAMPLE placeholder text the rebuild was carrying.
 *
 * NOTE: the Fishing Adventure agreement is abbreviated on the live site itself — several
 * of its clauses end in an ellipsis, and the last one is cut mid-word ("first written
 * abo"). That is reproduced faithfully rather than invented around. Both documents should
 * be reviewed by the client's lawyer, and the unabridged wording supplied, before anyone
 * signs against them.
 */

export interface WaiverDocument {
  /** Heading as the live site sets it. */
  title: string;
  /** Recitals: the parties, the WHEREAS clauses, and the NOW THEREFORE line. */
  preamble: string[];
  /** The numbered TERMS list. */
  terms: string[];
}

export const waiverDocuments: Record<'fishing-adventure' | 'lodge', WaiverDocument> = {
  'fishing-adventure': {
    title: 'Hold Harmless, Release & Indemnification Agreement',
    preamble: [
      'This HOLD HARMLESS, RELEASE, and INDEMNIFICATION AGREEMENT (this "Agreement") is made effective on this date by and between Big Daves Fishing Adventures, LLC (hereinafter, "Big Dave"), located at 17175 WILSON RIVER HWY TILLAMOOK OR 97141 USA and (hereinafter, "Guest"). Big Dave and Guest are sometimes individually referred to as "Party" and collectively referred to as the "Parties" in this Agreement.',
      "WHEREAS, Guest desires to use and has paid Big Dave for fishing guide services, equipment, boat(s), expertise, and related goods for the purpose of fishing anywhere in the State of Oregon including rivers, streams, tributaries, and the Pacific Ocean; and WHEREAS, Guest recognizes that fishing involves an inherently risky and dangerous activity including weather related events and physical elements beyond the control of Big Dave; and WHEREAS, A significant risk of bodily or personal injury, property damage, or other such damage exists while using Big Dave’s guide services, equipment, boat(s), expertise, and related goods and such risk and the assumption thereof is the sole responsibility of Guest; and WHEREAS, Big Dave specifically disclaims any responsibility or liability to Guest arising out of the services, equipment, boat(s), and expertise provided by Big Dave; and WHEREAS, Big Dave provides such guide services, all equipment including fishing gear and life jackets, boat(s), and expertise at the express request of Guest for such purposes, Guest therefore desires to hold harmless, release, and indemnify Big Dave, it’s owners, officers, members, agents, heirs and representatives from any all claims and/or litigation of whatever kind or nature, whether known or unknown, foreseen or unforeseen, arising out of the Guest's use of the Property or Guest’s failure to use such equipment as intended or otherwise fails to comply with all local, state, and federal regulations.",
    ],
    terms: [
      'Hold Harmless. Guest shall fully defend, indemnify, release and hold harmless Big Dave from any and all claims, lawsuits, demands, causes of action, liability, loss, damage and/or injury, of any kind whatsoever...',
      'Authority to Enter this Agreement. Each Party warrants that the individuals who have signed this Agreement have the actual legal power, right, and authority to make this Agreement and bind each respective Party.',
      'Amendment; Modification. No supplement, modification, or amendment of this Agreement shall be binding unless executed in writing and signed by both Parties.',
      'Waiver. No waiver of any default shall constitute a waiver of any other default or breach...',
      "Attorneys' Fees and Costs. If any legal action or other proceeding is brought in connection with this Agreement, the successful or prevailing Party shall be entitled to recover reasonable attorneys' fees...",
      'Entire Agreement. This Agreement contains the entire agreement between the Parties related to the matters specified herein and supersedes any prior oral or written statements or agreements.',
      'Enforceability, Severability, and Reformation. If any provision of this Agreement shall be held invalid, the remaining provisions shall continue to be valid and enforceable...',
      'Applicable Law. This Agreement shall be governed exclusively by the laws of Oregon, without regard to conflict of law provisions.',
      'Exclusive Venue and Jurisdiction. Any lawsuit or legal proceeding shall be exclusively brought and litigated in the federal and state courts of the State of Oregon...',
      'Signatories. This Agreement shall be signed on behalf of Big Dave, and on behalf of Guest, and effective as of the date first written abo',
    ],
  },
  lodge: {
    title: 'Hold Harmless, Release, Indemnification Agreement',
    preamble: [
      'This HOLD HARMLESS, RELEASE, and INDEMNIFICATION AGREEMENT (this "Agreement") is made effective on this date _____________________ by and between WRLodge, LLC dba Wilson River Lodge (hereinafter, "Wilson River"), located at 17175 WILSON RIVER HWY TILLAMOOK OR 97141 USA and ________________________________ (hereinafter, "Guest"). Wilson River and Guest are sometimes individually referred to as "Party" and collectively referred to as the "Parties"\' in this Agreement.',
      'WHEREAS, Guest desires to use and has paid for such use of Wilson River\'s house, grounds, accommodations, and personal property located at 17175 Wilson River Highway, Tillamook, OR 97141 (the "Property") for the purpose of overnight lodging (whether in conjunction with fishing either on the Property or offsite or simply as accommodation lodging); and',
      'WHEREAS, Any risk of bodily or personal injury, property damage, or other such damage while using Wilson River is the sole responsibility of Guest; and',
      'WHEREAS, Wilson River specifically disclaims any responsibility or liability to Guest while Guest is lodging at Wilson River; and',
      "WHEREAS, in exchange for making the Property available to Guest for such purposes, Guest agrees to comply with all local, state, and federal regulations while staying at Wilson River and desires to hold harmless, release, and indemnify Wilson River, it’s owners, officers, members, agents, heirs and representatives from any all claims and/or litigation of whatever kind or nature, whether known or unknown, foreseen or unforeseen, arising out of the Guest's use of the Property.",
      'NOW THEREFORE, in consideration of the mutual covenants and conditions contained herein, Wilson River and Guest hereby agree as follows:',
    ],
    terms: [
      "Hold Harmless. Guest shall fully defend, indemnify, release and hold harmless Wilson River from any and all claims, lawsuits, demands, causes of action, liability, loss, damage and/or injury, of any kind whatsoever (including without limitation all claims for monetary loss, property damage, equitable relief, personal injury, bodily injury, and/or wrongful death), whether brought by an individual or other entity, or imposed by a court of law or by administrative action of any federal, state, or local governmental body or agency, arising out of, in any way whatsoever, any acts, omissions, negligence, or willful misconduct on the part of either Guest or Wilson River, its officers, owners, personnel, employees, agents, contractors, invitees, or volunteers. This indemnification applies to and includes, without limitation, the payment of all penalties, fines, judgments, awards, decrees, attorneys' fees, and related costs or expenses, and any reimbursements to Wilson River for all legal fees, expenses, and costs incurred by it.",
      'Authority to Enter this Agreement. Each Party warrants that the individuals who have signed this Agreement have the actual legal power, right, and authority to make this Agreement and bind each respective Party.',
      'Amendment; Modification. No supplement, modification, or amendment of this Agreement shall be binding unless executed in writing and signed by both Parties.',
      'Waiver. No waiver of any default shall constitute a waiver of any other default or breach, whether of the same or other covenant or condition. No waiver, benefit, privilege, or service voluntarily given or performed by a Party shall give the other Party any contractual right by custom, estoppel, or otherwise.',
      "Attorneys' Fees and Costs. If any legal action or other proceeding is brought in connection with this Agreement, the successful or prevailing Party, if any, shall be entitled to recover reasonable attorneys' fees and other related costs, in addition to any other relief to which that Party is entitled. In the event that it is the subject of dispute, the court or trier of fact who presides over such legal action or proceeding is empowered to determine which Party, if any, is the prevailing party in accordance with this provision.",
      'Entire Agreement. This Agreement contains the entire agreement between the Parties related to the matters specified herein and supersedes any prior oral or written statements or agreements between the Parties related to such matters.',
      'Enforceability, Severability, and Reformation. If any provision of this Agreement shall be held to be invalid or unenforceable for any reason, the remaining provisions shall continue to be valid and enforceable. If a court finds that any provision of this Agreement is invalid or unenforceable, but that by limiting such provision it would become valid and enforceable, then such provision shall be deemed to be written, construed, and enforced as so limited. The intent of the Parties is to provide as broadindemnification as possible under Oregon law. If any aspect of this Agreement is deemed unenforceable, the court is empowered to modify this Agreement to give the broadest possible interpretation permitted under Oregon law.',
      'Applicable Law. This Agreement shall be governed exclusively by the laws of Oregon, without regard to conflict of law provisions.',
      'Exclusive Venue and Jurisdiction. Any lawsuit or legal proceeding arising out of or relating to this Agreement in any way whatsoever shall be exclusively brought and litigated in the federal and state courts of the State of Oregon. Each Party expressly consents and submits to this exclusive jurisdiction and exclusive venue in Tillamook County, Oregon. Each Party expressly waives the right to challenge this jurisdiction and/or venue as improper or inconvenient. Each Party consents to the dismissal of any lawsuit that they bring in any other jurisdiction or venue.',
      'Signatories. This Agreement shall be signed on behalf of Wilson River, and on behalf of Guest, and effective as of the date first written above. WRLodge LLC dba Wilson River Lodge',
    ],
  },
};
