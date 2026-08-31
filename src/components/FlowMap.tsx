export function FlowMap({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flow-map${compact ? ' flow-map--compact' : ''}`}
      aria-label="Input, throughput, and output model map"
    >
      <section className="flow-node flow-node--input">
        <span className="domain-symbol domain-symbol--circle" aria-hidden="true" />
        <div>
          <strong>Input</strong>
          <span>Arrivals · daily pattern · acuity</span>
        </div>
      </section>
      <span className="flow-arrow" aria-hidden="true">
        →
      </span>
      <section className="flow-node flow-node--throughput">
        <span className="domain-symbol domain-symbol--square" aria-hidden="true" />
        <div>
          <strong>Throughput</strong>
          <span>Spaces · duration · fast track</span>
        </div>
      </section>
      <span className="flow-arrow" aria-hidden="true">
        →
      </span>
      <section className="flow-node flow-node--output">
        <span className="domain-symbol domain-symbol--diamond" aria-hidden="true" />
        <div>
          <strong>Output</strong>
          <span>Admission · boarding · departure</span>
        </div>
      </section>
      <span className="flow-loop">Boarding holds the throughput space until ED departure.</span>
    </div>
  );
}
