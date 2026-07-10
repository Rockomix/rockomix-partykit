import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <article className="container prose mx-auto p-6 lg:prose-xl bg-slate-100 sm:my-8 rounded-lg shadow-lg">
      <h1>Terms of Service</h1>

      <h2>Introduction</h2>
      <p>
        Welcome to &quot;My Karaoke Party&quot;! These Terms of Service
        (&quot;Terms&quot;) govern your use of our web application
        (&quot;App&quot;) that allows users to search and play karaoke videos
        from YouTube. By using our App, you agree to these Terms. If you do not
        agree with these Terms, you may not use the App.
      </p>

      <h2>Personal Use Only</h2>
      <h3>Non-Commercial Use</h3>
      <p>
        &quot;My Karaoke Party&quot; is intended for personal use only. You
        agree to use the App solely for private enjoyment, in a non-commercial
        setting. This means:
      </p>
      <ul>
        <li>
          You may not use the App in any public place, such as bars,
          restaurants, clubs, or any other venues where the public has access.
        </li>
        <li>
          You may not charge any fee or receive any form of compensation for
          allowing others to use the App or for organizing karaoke events using
          the App.
        </li>
        <li>
          The App must not be used in any professional setting, including but
          not limited to commercial karaoke services, event hosting, or any
          other profit-making activities.
        </li>
      </ul>

      <h3>Private Locations</h3>
      <p>
        The App is designed for use in private spaces, such as homes or private
        gatherings. You agree not to use the App in any location where the
        public can attend or where a cover charge or any other form of payment
        is required for entry.
      </p>

      <h2>Performing Rights and Licensing</h2>
      <h3>Performing Rights</h3>
      <p>
        You acknowledge that using karaoke tracks and performing publicly can
        implicate performing rights, which are protected by law. By using the
        App, you agree to comply with all applicable copyright and performing
        rights laws.
      </p>
      <ul>
        <li>
          You are responsible for ensuring that any public performance of music,
          including karaoke, is properly licensed and that all necessary
          permissions are obtained from the relevant performing rights
          organizations (PROs).
        </li>
        <li>
          &quot;My Karaoke Party&quot; does not provide any licenses or
          permissions for public performances. You must independently obtain any
          required licenses from PROs such as ASCAP, BMI, SESAC, or their
          international equivalents.
        </li>
      </ul>

      <h2>User Responsibilities</h2>
      <h3>Compliance with Laws</h3>
      <p>
        You agree to use the App in compliance with all applicable laws,
        regulations, and guidelines, including but not limited to copyright laws
        and public performance regulations.
      </p>

      <h3>Prohibited Conduct</h3>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the App for any unlawful purpose or in any manner that could harm,
          disable, overburden, or impair the App.
        </li>
        <li>
          Interfere with any other party&apos;s use and enjoyment of the App.
        </li>
        <li>
          Attempt to gain unauthorized access to the App, its servers, or any
          data associated with the App.
        </li>
      </ul>

      <h2>Limitation of Liability</h2>
      <h3>No Liability for Unauthorized Use</h3>
      <p>
        &quot;My Karaoke Party&quot; is not responsible for any unauthorized or
        illegal use of the App. You agree to indemnify and hold harmless the
        App&apos;s creators and operators from any claims, damages, or
        liabilities arising from your use of the App in violation of these
        Terms.
      </p>

      <h3>Disclaimer of Warranties</h3>
      <p>
        The App is provided &quot;as is&quot; and &quot;as available&quot;
        without any warranties of any kind, either express or implied. We do not
        guarantee that the App will be uninterrupted, error-free, or free from
        harmful components.
      </p>

      <h2>Changes to Terms</h2>
      <h3>Modifications</h3>
      <p>
        We reserve the right to modify these Terms at any time. Any changes will
        be effective immediately upon posting the updated Terms on our website.
        Your continued use of the App after any changes constitutes your
        acceptance of the new Terms.
      </p>

      <h2>Contact Information</h2>
      <p>
        If you have any questions or concerns about these Terms or the App,
        please contact us at{" "}
        <a href="mailto:hello@mykaraoke.party">hello@mykaraoke.party</a>.
      </p>

      <p>
        By using &quot;My Karaoke Party&quot;, you acknowledge that you have
        read, understood, and agree to be bound by these Terms of Service.
      </p>

      <p>
        <Link className="link link-secondary" href="/">
          Back to Home
        </Link>
      </p>
    </article>
  );
}
