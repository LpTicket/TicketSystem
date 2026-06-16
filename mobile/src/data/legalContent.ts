// Legal copy ported 1:1 from the web (frontend/src/app/{privacy,terms,refunds,
// organizer-agreement}/page.tsx). Same numbered-heading / "* bullet" format the
// web LegalPage parser expects, rendered by LegalScreen with the mobile styles.

export type LegalKey = 'privacy' | 'terms' | 'refunds' | 'organizer-agreement';

export type LegalDoc = {
  titleEs: string;
  titleEn: string;
  lastUpdated: string;
  content: string;
};

const privacy = `1. Introduction
This Privacy Policy explains how LPTicket LLC collects, uses, stores, protects, discloses, and processes personal information when you visit, use, purchase tickets, create an account, register an event, contact support, or otherwise interact with LPticket.com.

2. Who We Are
LPTicket LLC operates LPticket.com. Our contact information is: 1325 Main St Suite 203, Katy, TX 77494, United States. Email: info@lpticket.com.

3. Information We Collect
We may collect personal information directly from you, automatically through your device, from payment processors, from Organizers, and from other service providers.
* Name and last name.
* Email address.
* Phone number.
* Billing information.
* Ticket purchase information.
* Event registration information.
* Ticket type, QR code, order number, and check-in status.
* Transaction history and payment status.
* IP address, device type, browser, operating system, and approximate location.
* Account login information.
* Customer support communications.
* Marketing preferences, when applicable.

4. Payment Information
Payments may be processed by Stripe or other authorized payment processors. LPTicket does not directly store full credit card or debit card numbers.
We may receive limited transaction information such as payment status, amount paid, last four digits of the card, transaction ID, fraud review status, date of purchase, and processor confirmations or rejections.

5. How We Use Information
We use personal information to operate the platform and provide our services, including to:
* Process ticket purchases.
* Issue digital tickets and QR codes.
* Send confirmations and event notices.
* Enable PDF downloads, Apple Wallet passes, and Google Wallet passes.
* Validate admission at events.
* Prevent fraud, duplicate tickets, fake tickets, and unauthorized access.
* Provide customer support.
* Process refunds when applicable.
* Comply with legal, tax, accounting, and regulatory obligations.
* Improve the platform and analyze performance.
* Send security notices, legal updates, and operational messages.
* Send marketing communications when permitted by law or with consent.

6. Information Shared with Organizers
When you purchase or register for an event, we may share certain information with the Organizer so the Organizer can manage the event.
* Buyer or attendee name.
* Email address.
* Phone number, if collected.
* Ticket type and quantity.
* Order status and payment status.
* Check-in status.
* Information reasonably necessary to manage access and event operations.
Organizers must use Buyer information only for legitimate event-related purposes and must comply with applicable privacy laws.

7. Information Shared with Service Providers
We may share information with providers that help us operate LPTicket, including payment processors, hosting providers, email providers, analytics tools, anti-fraud services, customer support tools, QR and ticketing vendors, storage providers, marketing tools, and legal or compliance advisors.
We share only the information reasonably necessary for those providers to perform services for us or to comply with legal obligations.

8. Cookies and Similar Technologies
We may use cookies, pixels, tags, analytics tools, and similar technologies to operate the site, remember preferences, maintain sessions, measure traffic, detect errors, improve performance, prevent fraud, personalize content, and measure marketing campaigns.
You may configure your browser to block cookies, but some site features may not work properly.

9. Marketing Communications
We may send transactional communications related to ticket purchases, confirmations, event changes, cancellations, refunds, security, legal notices, and account activity.
We may send promotional communications when permitted by law or with your consent. You may opt out of promotional emails by following the unsubscribe instructions or contacting us at info@lpticket.com. Transactional messages may continue even if you opt out of marketing.

10. Data Security
We use reasonable administrative, technical, and organizational measures to protect personal information against unauthorized access, loss, misuse, alteration, and disclosure. However, no digital system is completely secure, and we cannot guarantee absolute security.
Users are responsible for protecting their account credentials, email access, devices, and tickets.

11. Data Retention
We may retain personal information for as long as necessary to provide services, process tickets, resolve disputes, prevent fraud, maintain accounting records, comply with legal obligations, enforce agreements, and defend legal rights.
When information is no longer needed, we may delete, anonymize, or retain it as permitted by law.

12. Privacy Rights
Depending on applicable law, you may have rights to access, correct, delete, copy, limit, object to, or appeal certain decisions regarding your personal information.
To submit a privacy request, contact us at info@lpticket.com with the subject line 'Privacy Request.' We may need to verify your identity before processing the request.

13. Texas Privacy Rights
Residents of Texas may have rights under the Texas Data Privacy and Security Act when that law applies. These rights may include the right to access, correct, delete, obtain a copy of, opt out of certain processing, and appeal a privacy decision.
Texas residents may contact info@lpticket.com to exercise applicable privacy rights.

14. Children and Minors
LPTicket is intended for users who are 18 years of age or older. We do not knowingly collect personal information from minors under 18. If we learn that we have collected information from a minor without valid authorization, we may delete it.

15. Third-Party Links
LPTicket may contain links to third-party websites, including venues, artists, organizers, payment processors, social media platforms, sponsors, and external service providers. We are not responsible for the privacy practices, content, security, or policies of third-party websites.

16. International Processing
Information may be stored or processed in the United States or other countries where our service providers operate. By using LPTicket, you understand that your information may be transferred, stored, or processed outside your location in accordance with applicable law.

17. Changes to This Policy
We may update this Privacy Policy at any time. Changes may be posted on LPticket.com, reflected by a new updated date, sent by email, or displayed through the platform. Continued use of LPTicket after changes are effective means you accept the updated policy.

18. Contact
For privacy questions or requests, contact LPTicket LLC at info@lpticket.com or 1325 Main St Suite 203, Katy, TX 77494, United States.`;

const refunds = `1. Introduction
This Refund Policy explains how refunds, cancellations, postponements, event changes, invalid tickets, service fees, and payment disputes work on LPticket.com.

2. General Rule
LPTicket's general rule is that refunds depend on the Organizer, unless applicable law requires otherwise.
LPTicket is a ticketing and event access technology platform. In many cases, the Organizer is responsible for the event, its production, venue, date, time, rules, entry conditions, and refund policy.
When an event is organized directly by LPTicket LLC, Sundin Galue, or a related company, the specific refund policy posted for that event will apply.

3. Before Purchasing
Before purchasing a ticket, Buyers are responsible for reviewing:
* Event name.
* Date and time.
* Location and venue.
* Ticket type.
* Price and fees.
* Age restrictions.
* Identification requirements.
* Venue rules.
* Entry conditions.
* Refund policy.
* Event-specific terms and restrictions.
By completing a purchase, the Buyer accepts the posted conditions for that event.

4. Service Fees
LPTicket charges service fees to Buyers for use of the platform, ticket technology, digital delivery, QR generation, processing support, fraud prevention, customer support, and related operational costs.
To the fullest extent permitted by law, LPTicket service fees may be non-refundable, even when the Organizer approves a refund of the base ticket price.

5. How to Request a Refund
To request a refund, contact info@lpticket.com and include:
* Full name.
* Email used for the purchase.
* Event name.
* Order number or confirmation number.
* Reason for the request.
* Supporting evidence, if applicable.
LPTicket may review the request and, when appropriate, forward it to the Organizer. Approval may depend on the Organizer and the event's posted refund policy.

6. Cases Where Refunds Are Usually Not Available
Unless required by law or stated in the event's specific refund policy, refunds are usually not available when:
* The Buyer does not attend the event.
* The Buyer arrives late.
* The Buyer purchased the wrong ticket, date, or event.
* The Buyer failed to review the location or event details.
* The Buyer does not meet age requirements.
* The Buyer does not present valid identification when required.
* The Buyer violates venue or event rules.
* The Buyer is removed or denied entry for inappropriate conduct.
* The ticket was shared, copied, transferred, resold, or used by another person.
* The ticket was purchased outside LPTicket or official channels.
* The Buyer failed to download or access the ticket on time.
* The Buyer lost access to the email account used for purchase.

7. Cancelled Events
If an event is permanently cancelled, the Organizer is responsible for communicating available options to Buyers.
Options may include a full refund, partial refund, credit for another event, transfer to a new date, or another lawful solution.
LPTicket may assist with the technical processing of approved refunds, but does not guarantee funds if the proceeds have already been released to the Organizer or if external disputes, holds, or processor limitations apply.

8. Postponed or Rescheduled Events
If an event is postponed, rescheduled, or moved, tickets may remain valid for the new date, time, or location unless the Organizer states otherwise.
A schedule change does not automatically guarantee a refund unless the event policy or applicable law requires one.

9. Changes in Performers, Speakers, Sponsors, or Programming
Events may include artists, speakers, DJs, sponsors, vendors, brands, or scheduled activities that may change. Unless the specific event policy states otherwise, changes in performers, speakers, programming, sponsors, or secondary event elements do not automatically guarantee a refund.

10. Admission Denial
The Organizer, venue, security staff, or LPTicket may deny entry or remove a person from an event if the ticket is invalid, the QR code has already been used, the ticket was altered, the person does not meet age or identification requirements, the person violates safety rules, the person behaves aggressively, the person appears intoxicated, the person carries prohibited items, or the person violates these Terms.
Denial of entry for rule violations does not guarantee a refund.

11. Duplicated, Copied, or Resold Tickets
Each digital ticket may contain a unique QR code. If a ticket is copied, forwarded, shared, resold, or duplicated, only the first valid scan may be accepted.
LPTicket is not responsible if a Buyer shares a ticket and another person uses it first. Buyers should not purchase tickets from unofficial sources.

12. Refunded or Cancelled Tickets
A ticket that has been refunded, cancelled, voided, or marked invalid may not be used to enter an event. Attempting to use a refunded, fake, altered, or invalid ticket may be considered fraud.

13. Chargebacks
Before initiating a chargeback or bank dispute, Buyers should contact info@lpticket.com so LPTicket can attempt to resolve the issue.
If a Buyer initiates a fraudulent or invalid chargeback, LPTicket may cancel tickets, suspend the account, block future purchases, submit evidence to the bank, charge permitted administrative costs, and pursue legal remedies.

14. Refund Timing
If a refund is approved, the time required to receive funds depends on Stripe, the card issuer, the bank, the payment method, fraud review, and the Organizer's processes. LPTicket does not control bank or processor timelines.

15. Partial Refunds
Some refunds may be partial. A partial refund may exclude service fees, payment processing fees, administrative costs, venue charges, non-recoverable taxes, or other lawful non-refundable charges.

16. Free Events
For free events, LPTicket may cancel duplicate, suspicious, false, or abusive registrations. A free registration does not guarantee entry if the venue reaches capacity or if the attendee violates event rules.

17. Capacity Limits
Tickets and registrations remain subject to venue capacity, fire code, safety rules, arrival procedures, validation requirements, identification requirements, and applicable law.

18. Contact for Refunds
For refund requests, contact LPTicket LLC at info@lpticket.com.`;

const terms = `1. Acceptance of These Terms
Welcome to LPticket.com, a ticketing, event access, and event management platform operated by LPTicket LLC. By accessing, browsing, creating an account, purchasing tickets, downloading digital tickets, using QR codes, using Apple Wallet or Google Wallet passes, or otherwise using our services, you agree to be bound by these Terms and Conditions.
If you do not agree with these Terms, do not use the platform or purchase tickets through LPTicket.

2. Key Definitions
For purposes of these Terms, the following definitions apply:
* 'LPTicket,' 'we,' 'us,' or 'our' means LPTicket LLC, including its owners, directors, employees, contractors, vendors, technology providers, payment processors, and authorized representatives.
* 'Site' means LPticket.com and any related website, subdomain, application, dashboard, digital tool, or service operated by LPTicket.
* 'User' means any person who visits, uses, purchases, sells, manages, scans, or interacts with the platform.
* 'Buyer' means a person who purchases, receives, downloads, transfers, or uses a ticket.
* 'Organizer' means the person, company, brand, venue, promoter, producer, or entity responsible for creating, promoting, managing, producing, or operating an event. For certain events, the Organizer may be Sundin Galue, LPTicket LLC, a related company, or an authorized third party.
* 'Event' means any activity listed, sold, promoted, registered, managed, or accessed through LPTicket, including concerts, networking events, expos, workshops, conferences, shows, private experiences, corporate events, or digital experiences.
* 'Ticket' means any admission pass, registration, QR code, PDF, digital pass, Apple Wallet pass, Google Wallet pass, email confirmation, or other proof of access issued through the platform.
* 'User Content' means any text, images, logos, videos, names, trademarks, event descriptions, pricing, promotions, photos, graphics, or other material submitted to LPTicket.

3. Eligibility and Minimum Age
LPTicket is intended only for users who are at least 18 years old. By using the platform, you represent that you are 18 years of age or older and have legal capacity to enter into this agreement.
If you use LPTicket on behalf of a company, organization, brand, or other legal entity, you represent that you have authority to bind that entity to these Terms.

4. LPTicket's Role
LPTicket provides technology for ticket sales, event registration, digital ticket delivery, QR code validation, and event access management.
Depending on the event, LPTicket may act as a technology platform, ticketing service, payment support tool, access validation tool, promoter, or direct Organizer.
When an event is created or operated by a third-party Organizer, LPTicket is not the producer, venue operator, performer, security provider, seller of merchandise, or owner of the event. The Organizer is responsible for the event, including permits, safety, execution, refunds, venue compliance, and the accuracy of event information.
When an event is organized directly by LPTicket LLC, Sundin Galue, or a related company, these Terms still apply to the fullest extent permitted by law.

5. Organizer Responsibility
Each Organizer is solely responsible for the legality, production, promotion, operation, safety, venue compliance, permits, licenses, insurance, staffing, and delivery of its event.
Organizers must provide truthful and accurate event information and must comply with all applicable federal, state, county, city, venue, fire, health, alcohol, accessibility, and safety requirements.

6. Prohibited Events
Users may not use LPTicket for events or activities involving:
* Illegal activity or services.
* Violence, threats, harassment, or incitement of harm.
* Illegal drugs or controlled substances.
* Unauthorized weapons, explosives, or dangerous activities.
* Illegal gambling or unauthorized raffles.
* Sexual exploitation or prohibited explicit sexual activity.
* Fraud, scams, fake events, or misleading promotions.
* Hate, discrimination, extremism, terrorism, or harassment.
* Events without required permits, licenses, venue authorization, or insurance when applicable.
* Any activity that LPTicket determines may create legal, financial, safety, reputational, or operational risk.

7. User Accounts
Certain features may require an account. You agree to provide accurate, current, and complete information, keep your login credentials secure, and notify us immediately of any unauthorized account use.
You are responsible for all activity under your account, including activity by any person to whom you grant access.
LPTicket may suspend or terminate accounts that contain false information, suspicious activity, fraud, abuse, unpaid amounts, chargeback abuse, or violations of these Terms.

8. Ticket Purchases
By purchasing a ticket, you agree that the ticket is digital and may be delivered by email, PDF, QR code, Apple Wallet, Google Wallet, or another approved method.
You are responsible for reviewing the event name, date, time, location, ticket type, price, fees, refund policy, age restrictions, identification requirements, venue rules, and entry conditions before completing your purchase.
A ticket does not guarantee entry if you fail to comply with event rules, venue rules, legal requirements, identification requirements, dress code, age restrictions, safety instructions, or these Terms.

9. Digital Tickets, QR Codes, Apple Wallet, and Google Wallet
Each digital ticket may contain a unique QR code or access identifier. Unless otherwise stated, a QR code may be valid for one use only. Once scanned or validated, the ticket may be marked as used.
LPTicket is not responsible for tickets that are copied, shared, forwarded, duplicated, resold, altered, lost, or used by another person before you arrive.
Buyers should only purchase tickets through LPticket.com or authorized official channels.

10. Fees and Payments
LPTicket charges service fees to Buyers for the use of the platform. These fees may cover ticket technology, QR generation, digital delivery, processing support, fraud prevention, customer support, and related operational costs.
The final amount paid by a Buyer may include the base ticket price, LPTicket service fees, payment processing fees, taxes, venue charges, facility fees, and any other disclosed charges.
Payments may be processed by Stripe or other authorized third-party payment processors. LPTicket does not directly store full credit card or debit card numbers.

11. Stripe and Third-Party Payment Processors
By making or receiving payments through LPTicket, you agree that transactions may be processed by Stripe or another third-party processor and may be subject to that processor's terms, privacy policy, fraud screening, identity verification, holds, restrictions, and compliance requirements.
LPTicket does not control bank declines, payment holds, reversals, chargebacks, fraud reviews, processing delays, or decisions made by banks, card issuers, Stripe, or other payment providers.

12. Refunds
LPTicket's general policy is that refunds depend on the Organizer, unless applicable law requires otherwise.
Each event may have its own refund policy. Buyers should review that policy before purchasing. LPTicket may assist technically with refund processing, but LPTicket does not guarantee refunds unless required by law or expressly stated for a specific event.
Service fees may be non-refundable to the fullest extent permitted by law.

13. Invalid, Refunded, or Cancelled Tickets
A ticket that has been refunded, cancelled, voided, duplicated, altered, or marked invalid may not be used to enter an event. Attempting to use such a ticket may be considered fraud.
LPTicket, the Organizer, venue, or security staff may deny entry without compensation if a ticket is invalid or if the user violates applicable rules.

14. Transfers and Resale
LPTicket may allow or restrict ticket transfers depending on the event. Unauthorized resale, fake tickets, copied QR codes, altered digital tickets, bot purchases, or resale in violation of applicable law or event rules are prohibited.
LPTicket is not responsible for tickets purchased outside official channels.

15. Event Admission and Security
The Organizer, venue, security staff, or LPTicket may deny entry or remove any person who presents an invalid ticket, fails age or identification requirements, violates venue rules, appears intoxicated, behaves aggressively, carries prohibited items, creates a safety risk, or violates these Terms.
Denial of entry for rule violations does not guarantee a refund.

16. Assumption of Event Risks
By attending an event, you understand and voluntarily assume risks that may include personal injury, illness, accidents, crowd-related risks, loud noise, food or beverage exposure, weather conditions, transportation issues, parking issues, venue conditions, property loss, or other risks associated with live or digital events.
To the fullest extent permitted by law, you release LPTicket from claims arising from risks inherent in attending or participating in events.

17. User Content and Organizer Content
You are solely responsible for any content you submit to LPTicket. By submitting content, you represent that you have all rights necessary to use and authorize LPTicket to use that content.
You grant LPTicket a worldwide, non-exclusive, royalty-free, transferable, sublicensable license to use, display, reproduce, adapt, publish, distribute, promote, and modify User Content as necessary to operate, market, sell, manage, and support events and the platform.
LPTicket does not claim ownership of Organizer content, but requires this license to provide the services.

18. LPTicket Intellectual Property
All rights in LPTicket, including its name, logo, design, interface, software, code, ticketing system, QR tools, databases, text, graphics, structure, workflows, and platform features, belong to LPTicket LLC or its licensors.
You may not copy, reproduce, reverse engineer, scrape, crawl, clone, modify, sell, lease, exploit, or interfere with any part of the platform without written permission.

19. Prohibited Platform Use
You may not use LPTicket to commit fraud, create fake events, sell unauthorized tickets, upload malicious code, scrape data, use unauthorized bots, violate intellectual property rights, harass others, hide your identity in transactions, manipulate ticket availability, initiate fraudulent chargebacks, or damage LPTicket's reputation, systems, users, or business.

20. Privacy
Our collection and use of personal information is described in our Privacy Policy. By using LPTicket, you agree that your information may be collected, used, processed, shared, and retained as described in that policy.
Organizers who receive Buyer information must use it only for legitimate event-related purposes and must comply with applicable privacy laws.

21. Communications
By using LPTicket, you agree to receive transactional communications related to tickets, confirmations, event changes, refunds, security, support, legal notices, and account activity. Marketing communications may be sent when permitted by law or with your consent.

22. Suspension or Termination
LPTicket may suspend, limit, or terminate access to accounts, events, tickets, funds, or platform features if we believe a user has violated these Terms, engaged in fraud, created risk, violated law, abused chargebacks, manipulated tickets, or harmed the platform or other users.

23. Disclaimer of Warranties
The platform and services are provided on an 'as is' and 'as available' basis. To the fullest extent permitted by law, LPTicket disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, and uninterrupted operation.
We do not guarantee that every event will occur as described, that Organizer information will always be accurate, that the platform will be error-free, or that third-party services will operate without interruption.

24. Limitation of Liability
To the fullest extent permitted by law, LPTicket LLC and its owners, directors, employees, contractors, vendors, affiliates, partners, and representatives will not be liable for indirect, incidental, special, consequential, punitive, or exemplary damages, including loss of profits, goodwill, data, opportunities, reputation, or business.
LPTicket is not responsible for Organizer conduct, event cancellations, venue issues, third-party acts, payment processor failures, bank decisions, internet outages, ticket fraud outside official channels, injuries, accidents, or property damage occurring at events.
If LPTicket is found liable, LPTicket's maximum total liability will not exceed the service fees paid by the user to LPTicket for the transaction giving rise to the claim, or USD $100, whichever is less, unless applicable law requires otherwise.

25. Indemnification
You agree to defend, indemnify, and hold harmless LPTicket LLC and its owners, employees, representatives, contractors, vendors, processors, and affiliates from any claims, damages, losses, fines, investigations, legal fees, costs, or expenses arising from your use of the platform, your event, your content, your violation of these Terms, your violation of law, your fraud or negligence, your lack of permits, your misuse of Buyer information, or your violation of third-party rights.

26. Chargebacks and Payment Disputes
Before initiating a bank dispute or chargeback, Buyers should contact LPTicket at info@lpticket.com so we can attempt to resolve the matter.
If a user initiates a fraudulent or invalid chargeback, LPTicket may cancel tickets, suspend the account, block future purchases, provide evidence to the bank, charge permitted administrative costs, or pursue legal remedies.

27. Governing Law and Venue
These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles.
Any dispute not subject to arbitration will be brought in the competent state or federal courts located in Harris County, Texas, unless applicable law requires otherwise.

28. Arbitration and Class Action Waiver
To the fullest extent permitted by law, any dispute, claim, or controversy relating to LPTicket, these Terms, the platform, ticket purchases, or the services will be resolved through individual binding arbitration rather than in court, except for matters that may be brought in small claims court or matters that applicable law does not allow to be arbitrated.
You and LPTicket waive the right to participate in any class action, consolidated action, collective action, or representative proceeding to the fullest extent permitted by law.
Before starting any formal proceeding, the user must contact LPTicket at info@lpticket.com and allow a reasonable good-faith period to attempt resolution.

29. Legal Notices
Legal notices to LPTicket must be sent to: LPTicket LLC, 1325 Main St Suite 203, Katy, TX 77494, United States. Email: info@lpticket.com. Notices to users may be sent to the email address associated with the account or purchase.

30. Changes to These Terms
LPTicket may update these Terms at any time. Updates may be posted on LPticket.com, shown inside the platform, reflected by a new updated date, or sent by email. Continued use of the platform after changes become effective means you accept the updated Terms.

31. Assignment
LPTicket may assign, transfer, or delegate these Terms and its rights or obligations to an affiliate, successor, buyer, investor, strategic partner, or related entity without prior user consent. Users may not assign their rights or obligations without LPTicket's written approval.

32. Entire Agreement
These Terms, together with any incorporated policies, constitute the entire agreement between you and LPTicket regarding use of the platform. If any provision is found unenforceable, the remaining provisions will remain in effect.

33. Official Language
These Terms may be provided in Spanish and English. The Spanish version may be provided for convenience. In the event of conflict, the English version will control unless applicable law requires otherwise.

34. Contact
For support, refunds, ticket issues, privacy requests, or legal matters, contact LPTicket LLC at info@lpticket.com or 1325 Main St Suite 203, Katy, TX 77494, United States.`;

const organizerAgreement = `1. Introduction
This Organizer Agreement applies to any person, company, brand, promoter, producer, venue, or entity that creates, publishes, promotes, sells, manages, or operates events through LPticket.com.
By using LPTicket as an Organizer, you agree to this Organizer Agreement, the Terms and Conditions, the Privacy Policy, the Refund Policy, and any additional rules posted by LPTicket.

2. Parties
This agreement is between LPTicket LLC, located at 1325 Main St Suite 203, Katy, TX 77494, United States, and the Organizer using LPTicket to create, publish, sell, promote, or manage an event.

3. LPTicket's Role
LPTicket provides technology to publish events, sell tickets, process payments through third-party providers, issue digital tickets, generate QR codes, provide PDF downloads, support Apple Wallet and Google Wallet passes, validate access, manage registrations, and support event operations.
Unless LPTicket is expressly identified as the direct Organizer, LPTicket is not responsible for event production, safety, permits, staffing, venue operations, vendors, artists, speakers, sponsors, logistics, food, beverages, parking, security, or the final event experience.

4. Organizer Responsibilities
The Organizer is solely responsible for:
* Creating a real and lawful event.
* Having authority to produce, promote, and sell tickets for the event.
* Obtaining all required permits, licenses, authorizations, insurance, and approvals.
* Securing the venue and complying with venue rules.
* Complying with federal, state, county, city, fire, health, alcohol, accessibility, and safety laws.
* Publishing accurate and truthful event information.
* Disclosing age restrictions, identification requirements, entry rules, and refund policy.
* Managing customer service related to the event.
* Handling disputes related to the event.
* Providing the event as described or providing lawful remedies when required.

5. Permits and Licenses
Before selling tickets, the Organizer represents that it has or will obtain all licenses, permits, approvals, and authorizations required for the event.
This may include venue authorization, city or county permits, fire marshal approvals, alcohol permits, health permits, music licenses, security plans, insurance, artist agreements, vendor agreements, minor-related authorizations, and any other legally required approvals.
LPTicket may request evidence of permits, insurance, venue authorization, identity, tax information, or other documentation at any time. Failure to provide sufficient evidence may result in event suspension or cancellation.

6. Prohibited Events
Organizers may not use LPTicket for events involving illegal activities, illegal drugs, unauthorized weapons, violence, hate, discrimination, fraud, illegal gambling, sexual exploitation, fake events, events without required permits, dangerous unauthorized activities, terrorism, extremism, or any activity LPTicket considers risky, illegal, misleading, harmful, or damaging to the platform.

7. Event Information
The Organizer must publish clear, accurate, and complete event information, including event name, date, time, address, venue, age restrictions, event type, ticket prices, refund policy, entry rules, restrictions, performers, speakers, description, and any additional charges.
False, exaggerated, misleading, incomplete, or confusing information is prohibited.

8. Pricing and Fees
The Organizer acknowledges that LPTicket charges service fees to Buyers. The final Buyer price may include the base ticket price, LPTicket service fees, payment processing fees, taxes, venue charges, and other disclosed charges.
The Organizer may not hide, manipulate, misrepresent, or confuse Buyers regarding prices, fees, ticket types, availability, or restrictions.

9. Organizer Payouts
Organizer payouts may be subject to identity verification, bank verification, tax verification, fraud review, event completion, reserves, chargebacks, refund obligations, disputes, processor rules, and compliance requirements.
LPTicket may hold, delay, offset, or withhold payouts if there is suspected fraud, cancellation risk, refund exposure, chargeback activity, missing permits, missing documentation, violation of law, violation of Stripe rules, or other legal, financial, or reputational risk.

10. Stripe and Payment Processing
Organizers agree that payments may be processed by Stripe or other authorized third-party processors. Organizers must comply with processor rules, identity verification, banking requirements, anti-fraud reviews, tax reporting, holds, reserves, and compliance obligations.
LPTicket does not control all decisions made by Stripe, banks, card networks, or other payment providers.

11. Refunds
The Organizer is responsible for establishing and honoring the refund policy for each event.
If an event is cancelled, postponed, materially changed, or otherwise fails to occur as described, the Organizer must promptly notify LPTicket and Buyers, define a lawful solution, respond to refund requests, and maintain sufficient funds to cover refunds when required.
LPTicket may process approved refunds technically, but the Organizer remains economically responsible for refunds related to the Organizer's event, unless LPTicket expressly agrees otherwise in writing.

12. Event Cancellation
If the Organizer cancels an event, the Organizer must immediately notify LPTicket. LPTicket may suspend ticket sales, notify Buyers, process refunds, hold funds, charge outstanding fees, request a written explanation, or terminate the Organizer's account.

13. Access Control
The Organizer must validate tickets properly using LPTicket-approved tools and procedures. The Organizer must check QR validity, ticket status, ticket type, refund status, duplicate use, age requirements, and identification when applicable.
The Organizer is responsible for losses or disputes resulting from allowing entry with invalid, duplicated, refunded, or improperly verified tickets.

14. Event Safety
The Organizer must take reasonable safety measures, including appropriate security, capacity control, emergency exits, fire compliance, alcohol control, attendee protection, emergency planning, venue coordination, and liability insurance when appropriate.
LPTicket is not responsible for incidents caused by Organizer, venue, vendor, security, attendee, or third-party failures.

15. Organizer Content
The Organizer represents that it has all rights necessary to use and submit logos, photos, videos, music, trademarks, trade names, artist images, speaker images, sponsor materials, and promotional content.
The Organizer grants LPTicket a worldwide, non-exclusive, royalty-free, transferable, sublicensable license to use, display, reproduce, adapt, publish, distribute, and promote Organizer Content for purposes of publishing, selling, promoting, managing, and supporting the event and the platform.

16. Intellectual Property
The Organizer receives no ownership rights in the LPTicket platform, software, code, brand, design, QR system, database, interface, workflows, or tools. Copying, cloning, reverse engineering, scraping, modifying, or misusing any part of LPTicket is prohibited.

17. Buyer Data
The Organizer may receive limited Buyer information for legitimate event-related purposes. The Organizer agrees to protect Buyer information, use it only for event-related purposes, not sell it, not share it without authorization, not send unlawful spam, and comply with applicable privacy laws.
The Organizer is responsible for any misuse, breach, unauthorized disclosure, or unlawful processing of Buyer data by the Organizer or its personnel.

18. Taxes
The Organizer is responsible for determining, collecting, reporting, and paying all taxes applicable to the event unless LPTicket expressly states otherwise in writing. This may include sales tax, local taxes, entertainment taxes, accounting records, tax forms, and other obligations.
LPTicket may request tax information before releasing payouts.

19. Event Promotion
LPTicket may, but is not obligated to, promote events listed on the platform. The Organizer authorizes LPTicket to use the event name, logo, images, videos, descriptions, and details for promotion on LPticket.com, social media, emails, advertisements, digital materials, marketing campaigns, and internal or external communications.

20. Prohibited Organizer Conduct
Organizers may not create fake events, publish misleading information, sell tickets without authority, inflate capacity, hide restrictions, fail to deliver the event, manipulate sales, commit fraud, misuse Buyer data, evade fees, initiate fraudulent chargebacks, damage LPTicket's reputation, publish illegal content, or violate third-party rights.

21. Suspension or Removal of Events
LPTicket may suspend, remove, cancel, or restrict an event if the event violates this agreement, appears fraudulent, lacks required permits, contains false information, receives excessive complaints, creates legal risk, violates Stripe rules, infringes rights, threatens public safety, or may harm LPTicket's reputation.

22. Indemnification
The Organizer agrees to defend, indemnify, and hold harmless LPTicket LLC and its owners, employees, representatives, contractors, vendors, processors, and affiliates from any claims, damages, losses, fines, investigations, lawsuits, legal fees, costs, or expenses arising from the event, lack of permits, cancellation, injuries, property damage, fraud, misleading advertising, legal violations, misuse of data, infringement of third-party rights, breach of this agreement, refunds, chargebacks, or Organizer conduct.

23. Limitation of Liability
To the fullest extent permitted by law, LPTicket will not be liable for event failures, cancellations, venue issues, accidents, injuries, property damage, lost profits, Buyer claims, Organizer breaches, third-party failures, Stripe issues, bank issues, fraud by third parties, or errors in information published by the Organizer.

24. Termination
LPTicket may terminate the relationship with an Organizer at any time if LPTicket determines that there is breach, fraud, abuse, legal risk, safety risk, reputational risk, or potential harm to the platform.
Termination does not eliminate the Organizer's pending obligations, including refunds, chargebacks, taxes, indemnification, disputes, legal responsibilities, and payment obligations.

25. Governing Law and Venue
This Organizer Agreement is governed by the laws of the State of Texas. Any dispute not subject to arbitration will be handled in competent courts located in Harris County, Texas, unless applicable law requires otherwise.

26. Contact
For Organizer-related matters, contact LPTicket LLC at info@lpticket.com or 1325 Main St Suite 203, Katy, TX 77494, United States.`;

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  privacy: { titleEs: 'Política de Privacidad', titleEn: 'Privacy Policy', lastUpdated: 'May 14, 2026', content: privacy },
  terms: { titleEs: 'Términos y Condiciones', titleEn: 'Terms and Conditions', lastUpdated: 'May 14, 2026', content: terms },
  refunds: { titleEs: 'Política de Reembolsos', titleEn: 'Refund Policy', lastUpdated: 'May 14, 2026', content: refunds },
  'organizer-agreement': { titleEs: 'Acuerdo de Organizador', titleEn: 'Organizer Agreement', lastUpdated: 'May 14, 2026', content: organizerAgreement },
};
