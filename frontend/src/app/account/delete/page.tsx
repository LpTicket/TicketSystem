'use client';

export default function DeleteAccountPage() {
  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#111' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Delete Your LPTicket Account</h1>
      <p style={{ color: '#555', marginBottom: 32 }}>
        To request deletion of your account and all associated data, please send an email to{' '}
        <a href="mailto:info@lpticket.com" style={{ color: '#F97316' }}>info@lpticket.com</a>{' '}
        with the subject line <strong>"Account Deletion Request"</strong> and include the email address associated with your account.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>What data will be deleted</h2>
      <ul style={{ color: '#555', lineHeight: 1.8, marginBottom: 32 }}>
        <li>Your name, email address, and profile information</li>
        <li>Your purchase history and ticket records</li>
        <li>Any events you have created as an organizer</li>
        <li>All personal data associated with your account</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Data we may retain</h2>
      <ul style={{ color: '#555', lineHeight: 1.8, marginBottom: 32 }}>
        <li>Transaction records required by law for tax and accounting purposes (up to 7 years)</li>
        <li>Anonymized analytics data that cannot be linked back to you</li>
      </ul>

      <p style={{ color: '#555' }}>
        We will process your request within 30 days. For more information, see our{' '}
        <a href="/privacy" style={{ color: '#F97316' }}>Privacy Policy</a>.
      </p>
    </main>
  );
}
