// TODO: Kunden-spezifische AGB erweitern:
// - Stornierungsgebühren (z.B. nach Fahrer-Annahme)
// - Haftung bei Paketschäden
// - Maximale Paketgröße/Gewicht pro Fahrzeugtyp
// - Verbotene Gegenstände (Gefahrgut, etc.)
// - Reklamationsprozess

'use client';

import Link from 'next/link';

export default function AGBPage() {
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
        <h1 className="text-lg font-bold text-gray-900">Allgemeine Geschäftsbedingungen</h1>
      </div>

      <div className="px-5 pt-6 max-w-2xl mx-auto space-y-6">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§1 Geltungsbereich</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Radler-Plattform,
            erreichbar unter radler-deutschland.de und fahrer.radler-deutschland.de.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            Betreiber: Timon Singer, Lemonenstraße 12, 78462 Konstanz.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§2 Leistungsbeschreibung</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Radler ist eine Vermittlungsplattform für Kurierdienste per Fahrrad.</li>
            <li>Radler vermittelt Aufträge zwischen Auftraggebern (Kunden) und selbstständigen Kurierfahrern (Fahrern).</li>
            <li>Radler ist <strong>nicht</strong> der Kurierdienst selbst, sondern ausschließlich Vermittler.</li>
            <li>Der Beförderungsvertrag kommt direkt zwischen Kunde und Fahrer zustande.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§3 Registrierung und Account</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Mindestalter für die Nutzung: 18 Jahre.</li>
            <li>Alle Angaben bei der Registrierung müssen wahrheitsgemäß sein.</li>
            <li>Jeder Nutzer darf nur einen Account haben.</li>
            <li>Bei Verstoß gegen diese AGB kann der Account gesperrt werden.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§4 Für Kunden</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Eine Buchung ist nach Bestätigung verbindlich.</li>
            <li>Eine Stornierung ist kostenlos möglich, solange kein Fahrer den Auftrag angenommen hat.</li>
            <li>Nach Annahme durch einen Fahrer ist eine Stornierung möglich; ggf. wird in Zukunft eine Stornogebühr erhoben.</li>
            <li>Die Bezahlung erfolgt bar bei Lieferung. Weitere Zahlungsmethoden sind in Planung.</li>
            <li>Bewertungen müssen sachlich und wahrheitsgemäß sein.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§5 Für Fahrer</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Fahrer sind selbstständige Unternehmer und <strong>keine</strong> Angestellten von Radler.</li>
            <li>Fahrer sind verpflichtet, ein angemeldetes Gewerbe zu haben.</li>
            <li>Fahrer sind verpflichtet, eine Betriebshaftpflichtversicherung zu haben.</li>
            <li>Fahrer entscheiden frei, wann sie online gehen und welche Aufträge sie annehmen.</li>
            <li>Radler gibt keine Weisungen zu Routen, Arbeitszeiten oder Auftragsannahme.</li>
            <li>Radler erhebt eine Vermittlungsprovision von 15% pro abgeschlossenem Auftrag.</li>
            <li>Der Fahrer erhält 85% des Auftragspreises.</li>
            <li>Fahrer sind für ihre eigenen Steuerpflichten verantwortlich.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§6 Haftung</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Radler haftet nicht für Schäden, die während des Transports entstehen.</li>
            <li>Die Haftung für Transportschäden liegt beim Fahrer und dessen Versicherung.</li>
            <li>Radler haftet nicht für Verspätungen oder Nichterfüllung durch den Fahrer.</li>
            <li>Radler haftet für die technische Verfügbarkeit der Plattform im Rahmen des Zumutbaren.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§7 Datenschutz</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Es gelten die Bestimmungen unserer{' '}
            <Link href="/datenschutz" className="text-primary underline">Datenschutzerklärung</Link>.
            GPS-Daten werden nur während der aktiven Nutzung der Plattform erhoben.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§8 Bewertungen</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Kunden können Fahrer nach Abschluss einer Lieferung bewerten (1-5 Sterne und optionaler Kommentar).</li>
            <li>Bewertungen müssen sachlich sein.</li>
            <li>Radler behält sich vor, unsachliche Bewertungen zu entfernen.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§9 Kündigung</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Beide Seiten können den Account jederzeit löschen.</li>
            <li>Bei schweren Verstößen gegen diese AGB ist eine sofortige Sperrung möglich.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§10 Änderungen der AGB</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Radler kann diese AGB ändern.</li>
            <li>Nutzer werden per E-Mail über Änderungen informiert.</li>
            <li>Die Weiternutzung der Plattform nach Änderung gilt als Zustimmung.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">§11 Schlussbestimmungen</h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>Gerichtsstand ist Konstanz.</li>
            <li>Es gilt deutsches Recht.</li>
            <li>Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleiben die übrigen Bestimmungen davon unberührt.</li>
          </ul>
        </section>

        <p className="text-xs text-gray-400 pt-4">Stand: April 2026</p>
      </div>
    </div>
  );
}
