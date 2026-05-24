import LegalPage from '@/components/layout/LegalPage';

export const revalidate = 3600; // ISR: revalidar cada hora

export default function PrivacyPage() {
  const content = `1. Introduction
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

  return (
    <LegalPage 
      title="Privacy Policy" 
      lastUpdated="May 14, 2026" 
      content={content} 
    />
  );
}
