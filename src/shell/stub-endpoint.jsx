// Zaślepka końcówki używana przy budowaniu z --only=… (moduły, których nie budujemy w danej chwili).
export default function StubEndpoint() {
  return <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: '120px', padding: '24px', color: '#45574D', font: '700 14px Helvetica, Arial, sans-serif', background: '#EEF6F2', textAlign: 'center' }}>Moduł wyłączony w tej kompilacji (zaślepka).</div>;
}
