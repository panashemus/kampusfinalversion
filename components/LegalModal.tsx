'use client';

import { X } from 'lucide-react';

type LegalType = 'terms' | 'privacy' | null;

export default function LegalModal({
  type,
  onClose,
}: {
  type: LegalType;
  onClose: () => void;
}) {
  if (!type) return null;

  const isTerms = type === 'terms';

  return (
    <div className="fixed inset-0 z-[2200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] max-h-[85vh] overflow-y-auto bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">
            {isTerms ? 'Terms of Service' : 'Privacy Policy'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>

        {isTerms ? (
          <div className="flex flex-col gap-4 text-sage text-xs leading-relaxed">
            <section>
              <h3 className="text-white font-bold text-sm mb-1">1. Platform Description</h3>
              <p>Kampus is a peer-to-peer student community assistance platform. Kampus is NOT an official emergency response unit, law enforcement agency, or campus security service. In case of immediate life-threatening danger, contact campus security or emergency services (999/997) directly.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">2. User Accounts</h3>
              <p>You must use your valid student email address to create an account. You are responsible for maintaining the security of your account and password. Kampus cannot be liable for any loss or damage from unauthorized account access.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">3. Marketplace Usage</h3>
              <p>The Kampus marketplace is a peer-to-peer platform connecting student buyers and sellers. Kampus facilitates listings and communication but does not guarantee, inspect, or warranty any transaction. All trades are conducted at the users own risk. Always inspect items in a public campus location before payment.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">4. Escrow &amp; Payments</h3>
              <p>Escrow services are provided as a convenience feature. Kampus is not a financial institution. Payment reference codes are used for audit purposes. Listings may be suspended if payment cannot be verified.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">5. Prohibited Conduct</h3>
              <p>You agree not to post illegal, harassing, fraudulent, or inappropriate content. Reported content may be reviewed and removed by administrators. Repeated violations may result in account suspension.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">6. Safety Disclaimer</h3>
              <p>The Safety Radar and SOS features are community-driven and do not replace official emergency services. Always contact official emergency services (999/997) for life-threatening situations. Kampus is not liable for outcomes of community-reported safety information.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">7. Limitation of Liability</h3>
              <p>Kampus is provided &quot;as is&quot; without warranties of any kind. To the fullest extent permitted by law, Kampus shall not be liable for any indirect, incidental, or consequential damages arising from use of the platform.</p>
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-sage text-xs leading-relaxed">
            <section>
              <h3 className="text-white font-bold text-sm mb-1">1. Data We Collect</h3>
              <p>We collect your student email address, username, university affiliation, and location data (when you use Safety Radar features). We also store content you post, including questions, marketplace listings, comments, and images.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">2. How We Use Your Data</h3>
              <p>Your data is used to provide and improve Kampus features: community feed, marketplace, safety radar, and direct messaging. We use your email to send verification codes and important account notifications.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">3. Data Sharing</h3>
              <p>We do not sell your data. Your username and posted content are visible to other verified students. Your email and location data are never shared with other users. Aggregate, anonymized data may be used for analytics.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">4. Data Security</h3>
              <p>All data is stored securely using Supabase infrastructure with row-level security policies. Passwords are hashed and never stored in plain text. Image uploads are stored in a public bucket but only accessible via authenticated upload.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">5. Marketplace Safety</h3>
              <p>Marketplace listings and buyer-seller communications are visible to platform administrators for moderation. We encourage all transactions to be conducted in public campus locations. Never share financial details (PINs, passwords) through Kampus chat.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">6. Your Rights</h3>
              <p>You may request deletion of your account and associated data at any time by contacting support. Upon deletion, your posts, listings, and messages will be permanently removed.</p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">7. Push Notifications</h3>
              <p>Push notification opt-in is voluntary. You can enable or disable notifications at any time in your browser settings. We do not send promotional notifications — only safety alerts and post interaction updates.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
