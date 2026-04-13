'use client';

import Link from 'next/link';

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center gap-3">
        <Link href="/login">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Datenschutzerklärung</h1>
      </div>

      <div className="px-5 pt-6 max-w-2xl mx-auto space-y-6">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Verantwortlicher</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Verantwortlich für die Datenverarbeitung auf dieser Website ist:
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            Timon Singer<br />
            Lemonenstraße 12<br />
            78462 Konstanz<br />
            E-Mail: kontakt@radler-deutschland.de
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">2. Welche Daten wir erheben</h2>
          <p className="text-sm text-gray-700 leading-relaxed">Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mt-2 list-disc pl-5 space-y-1">
            <li><strong>Registrierungsdaten:</strong> Name, E-Mail-Adresse, Telefonnummer</li>
            <li><strong>Standortdaten:</strong> GPS-Position bei der Buchung und während des Live-Trackings der Lieferung</li>
            <li><strong>Buchungsdaten:</strong> Abhol- und Zieladressen, Preise, Zeitstempel</li>
            <li><strong>Fotos:</strong> Abholfotos und Ablieferungsfotos, die der Kurier während der Lieferung aufnimmt</li>
            <li><strong>Bewertungen:</strong> Sternebewertungen und Kommentare zu abgeschlossenen Lieferungen</li>
            <li><strong>Technische Daten:</strong> IP-Adresse, Browsertyp, Geräteinformationen, Zugriffszeitpunkte</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">3. Zweck der Datenverarbeitung</h2>
          <p className="text-sm text-gray-700 leading-relaxed">Wir verarbeiten Ihre Daten zu folgenden Zwecken:</p>
          <ul className="text-sm text-gray-700 leading-relaxed mt-2 list-disc pl-5 space-y-1">
            <li><strong>Erbringung des Kurierdienstes:</strong> Vermittlung von Kurierdiensten zwischen Kunden und Fahrern, Abwicklung von Buchungen</li>
            <li><strong>Standortermittlung:</strong> Zuordnung verfügbarer Fahrer in der Nähe (Fahrer-Matching) und Echtzeit-Tracking der Lieferung</li>
            <li><strong>Zahlungsabwicklung:</strong> Berechnung und Dokumentation der Lieferkosten</li>
            <li><strong>Bewertungssystem:</strong> Qualitätssicherung des Dienstes durch Kundenbewertungen</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">4. Rechtsgrundlage</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:
          </p>
          <ul className="text-sm text-gray-700 leading-relaxed mt-2 list-disc pl-5 space-y-1">
            <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertragserfüllung): Die Verarbeitung ist zur Erfüllung des Nutzungsvertrags erforderlich, insbesondere für die Buchung und Durchführung von Kurierfahrten.</li>
            <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> (Berechtigtes Interesse): Wir haben ein berechtigtes Interesse an der Verarbeitung technischer Daten zur Gewährleistung der Sicherheit und Funktionsfähigkeit unseres Dienstes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">5. Datenweitergabe an Dritte</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Wir geben Ihre personenbezogenen Daten grundsätzlich nicht an Dritte weiter, mit folgender Ausnahme:
          </p>
          <ul className="text-sm text-gray-700 leading-relaxed mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Google Maps:</strong> Wir nutzen Google Maps zur Kartendarstellung und Routenberechnung.
              Dabei können Daten (insbesondere IP-Adresse und Standortdaten) an Google LLC übermittelt werden.
              Es gelten die Datenschutzbestimmungen von Google:{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                https://policies.google.com/privacy
              </a>
            </li>
          </ul>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            Eine Weitergabe an sonstige Dritte findet nicht statt.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">6. Speicherdauer</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Ihre personenbezogenen Daten werden gespeichert, solange Ihr Benutzerkonto besteht. Nach Löschung
            Ihres Kontos werden Ihre Daten gelöscht, sofern keine gesetzlichen Aufbewahrungsfristen
            (z. B. steuerrechtliche Aufbewahrungspflichten) einer Löschung entgegenstehen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">7. Ihre Rechte</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Sie haben gemäß DSGVO folgende Rechte bezüglich Ihrer personenbezogenen Daten:
          </p>
          <ul className="text-sm text-gray-700 leading-relaxed mt-2 list-disc pl-5 space-y-1">
            <li><strong>Auskunftsrecht</strong> (Art. 15 DSGVO): Sie können Auskunft über Ihre bei uns gespeicherten Daten verlangen.</li>
            <li><strong>Berichtigungsrecht</strong> (Art. 16 DSGVO): Sie können die Berichtigung unrichtiger Daten verlangen.</li>
            <li><strong>Löschungsrecht</strong> (Art. 17 DSGVO): Sie können die Löschung Ihrer Daten verlangen.</li>
            <li><strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO): Sie können die Einschränkung der Verarbeitung verlangen.</li>
            <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Sie können verlangen, Ihre Daten in einem gängigen Format zu erhalten.</li>
            <li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO): Sie können der Verarbeitung Ihrer Daten widersprechen.</li>
          </ul>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            Darüber hinaus haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die
            Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">8. Kontakt für Datenschutzanfragen</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Für Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:<br />
            E-Mail: kontakt@radler-deutschland.de
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">9. Cookies und lokale Speicherung</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Wir verwenden keine Tracking-Cookies oder Analyse-Tools. Es werden ausschließlich technisch
            notwendige Daten im lokalen Speicher Ihres Browsers gespeichert (localStorage), insbesondere
            ein Authentifizierungs-Token (JWT) für die Anmeldung. Dieses dient ausschließlich der
            Aufrechterhaltung Ihrer Sitzung.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">10. SSL-Verschlüsselung</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Diese Seite nutzt aus Sicherheitsgründen eine SSL- bzw. TLS-Verschlüsselung (HTTPS).
            Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers
            von &quot;http://&quot; auf &quot;https://&quot; wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
            Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten, die Sie an uns
            übermitteln, nicht von Dritten mitgelesen werden.
          </p>
        </section>

        <p className="text-xs text-gray-400 pt-4">Stand: April 2026</p>
      </div>
    </div>
  );
}
