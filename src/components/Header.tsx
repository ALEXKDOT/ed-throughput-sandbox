interface HeaderProps {
  onMethodology: () => void;
  onSensitivity: () => void;
  onVisualizer: () => void;
}

export function Header({ onMethodology, onSensitivity, onVisualizer }: HeaderProps) {
  const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL;
  return (
    <>
      <header className="site-header">
        <a className="brand" href="./" aria-label="ED Throughput Sandbox home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>ED Throughput Sandbox</span>
        </a>
        <nav aria-label="Project navigation">
          <button className="workspace-link" type="button" onClick={onVisualizer}>
            Open Visualizer
          </button>
          <button className="text-button" type="button" onClick={onSensitivity}>
            Sensitivity
          </button>
          <button className="text-button" type="button" onClick={onMethodology}>
            Methodology
          </button>
          {repositoryUrl && (
            <a className="text-button link-button" href={repositoryUrl}>
              Source
            </a>
          )}
        </nav>
      </header>
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <div className="eyebrow">Emergency department operations · discrete-event simulation</div>
          <h1 id="page-title">ED Throughput Sandbox</h1>
          <p className="hero-subtitle">
            Model the effects of arrivals, treatment capacity, care duration, admissions, and
            boarding on emergency-department flow.
          </p>
          <p className="hero-support">
            Configure synthetic assumptions, run repeated simulations, and compare waits, occupancy,
            departures, and boarding.
          </p>
        </div>
        <div className="status-stack" aria-label="Application status">
          <span className="status-badge">Synthetic model</span>
          <span className="status-badge">No patient data</span>
          <span className="status-badge">Educational use</span>
        </div>
      </section>
    </>
  );
}
