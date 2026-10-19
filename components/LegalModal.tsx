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
    <div className="fixed inset-0 z-[7500] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[430px] max-h-[85vh] overflow-y-auto bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">
            {isTerms ? 'Terms of Service' : 'Privacy Policy'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>

        {isTerms ? (
          <div className="flex flex-col gap-4 text-sage text-xs leading-relaxed">
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                1. Platform Description
              </h3>
              <p>
                Kampus is a peer-to-peer student community and academic
                assistance platform. Kampus is NOT an official emergency
                response unit, law enforcement agency, or campus security
                service. In case of immediate life-threatening danger, contact
                campus security or emergency services (999/997) directly.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                2. Institutional Accounts
              </h3>
              <p>
                You must use a valid institutional student email address (UB,
                BAC / BSBS, BIUST, Botho, or BUAN) to create an account. Account
                sharing is strictly prohibited.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                3. Marketplace Usage
              </h3>
              <p>
                The Kampus marketplace connects student buyers and sellers.
                Kampus facilitates listings and communication but does not
                warranty any physical item. Always inspect items in a public
                campus location before releasing payment.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                4. Escrow &amp; Payments
              </h3>
              <p>
                Escrow services and reference codes are provided for transaction
                verification. Listings or subscriptions may be suspended if
                payment references cannot be verified against bank records.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                5. Kampus Kritic Unlimited &amp; Fair Use Policy
              </h3>
              <p>
                Each verified student account receives one (1) complimentary
                Kampus Kritic prompt. The P50/month Unlimited Kritic membership
                grants ongoing access for individual academic coursework
                auditing. Under our Fair Use Policy, &quot;Unlimited&quot; usage
                is subject to a standard fair-use compute ceiling of 150 deep
                assignment audits or 350,000 tokens per 30-day billing cycle to
                prevent automated scraping, commercial resale, or multi-user
                account sharing.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                6. Prohibited Conduct
              </h3>
              <p>
                You agree not to post illegal, harassing, fraudulent, or
                inappropriate content. Repeated violations may result in account
                suspension.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                7. Limitation of Liability
              </h3>
              <p>
                Kampus and Kampus Kritic academic benchmarks are provided
                &quot;as is&quot; as study and pre-submission aids without
                warranties of specific examination outcomes.
              </p>
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-sage text-xs leading-relaxed">
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                1. Data We Collect
              </h3>
              <p>
                We collect your student email address, username, university
                affiliation, course code, and location data (when you use Safety
                Radar features). We also store content you post or audit.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                2. How We Use Your Data
              </h3>
              <p>
                Your data is used to calibrate Kampus Kritic to your specific
                institution and course, operate the community feed, marketplace,
                safety radar, and direct messaging.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                3. Data Sharing &amp; Anonymity
              </h3>
              <p>
                We do not sell your personal data. Donated academic benchmark
                papers are stripped of personal student identifiers prior to
                indexing.
              </p>
            </section>
            <section>
              <h3 className="text-white font-bold text-sm mb-1">
                4. Data Security
              </h3>
              <p>
                All data is stored securely using Supabase infrastructure with
                row-level security policies.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
