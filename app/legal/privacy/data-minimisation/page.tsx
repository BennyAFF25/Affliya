export default function DataMinimisationPolicy() {
  return (
    <main className="min-h-screen bg-[#0b0f10] text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Data Minimisation Policy
        </h1>

        <p className="text-sm text-gray-400 mb-10">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This Data Minimisation Policy explains how <strong>Nettmark Pty Ltd</strong>{" "}
            (“Nettmark”, “we”, “us”, or “our”) limits the collection, access,
            use, retention, and disclosure of personal information and platform
            data to what is reasonably necessary to operate and secure Nettmark,
            provide requested services, and meet applicable legal obligations.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            1. Our Data Minimisation Principle
          </h2>
          <p>
            Nettmark aims to collect and process only the information reasonably
            necessary for a defined and legitimate purpose. We avoid collecting
            information merely because it may be useful in the future and review
            our use of data as our services change.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            2. Platform and Third-Party Data
          </h2>
          <p>
            Where a user connects a third-party service, including Meta, Nettmark
            accesses and processes only the platform data reasonably required to
            provide the connected features the user has requested. This may
            include information needed to identify authorised business assets,
            create or manage approved advertising activity, display relevant
            campaign information, measure performance, maintain security, and
            support the connection.
          </p>
          <p>
            Nettmark does not use third-party platform data for unrelated
            purposes. Access is limited to authorised systems, personnel, and
            service providers where access is necessary to provide or protect
            the service.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            3. Retention and Deletion
          </h2>
          <p>
            We retain personal information and platform data only for as long as
            reasonably necessary for the purpose for which it was collected,
            including operational, security, accounting, dispute-resolution, and
            legal requirements. Data that is no longer reasonably required is
            deleted, de-identified, or otherwise handled in accordance with our
            Privacy Policy and applicable obligations.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            4. Service Providers
          </h2>
          <p>
            Nettmark may use service providers to host, process, secure, or
            transmit data on our behalf. We limit the information made available
            to those providers to what is reasonably necessary for the service
            they provide and expect them to handle that information consistently
            with applicable contractual and legal requirements.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            5. Requests from Public Authorities
          </h2>
          <p>
            If Nettmark receives a request from a public authority for personal
            information or platform data, we will assess the request and disclose
            only the minimum information reasonably necessary to comply with a
            valid legal requirement. We will not voluntarily provide additional
            data beyond what is reasonably required by the valid request.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            6. Access and Internal Handling
          </h2>
          <p>
            Access to personal information and platform data is limited according
            to operational need. Nettmark seeks to design product flows,
            integrations, permissions, and internal processes so that data access
            is proportionate to the function being performed.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            7. Review
          </h2>
          <p>
            Nettmark may review and update this policy as the Platform, connected
            services, legal requirements, or our data practices change. Material
            updates will be reflected on this page.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            8. Contact
          </h2>
          <p>
            Questions about this policy or Nettmark&apos;s handling of personal or
            platform data can be sent to:
          </p>
          <p>
            <strong>Email:</strong> contact@nettmark.com
            <br />
            <strong>Website:</strong> https://nettmark.com
          </p>
        </div>
      </div>
    </main>
  );
}
