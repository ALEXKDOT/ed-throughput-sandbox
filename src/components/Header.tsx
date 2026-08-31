interface HeaderProps {
  onMethodology: () => void;
  onSensitivity: () => void;
}

export function Header({ onMethodology, onSensitivity }: HeaderProps) {
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
            Explore how demand, treatment capacity, care duration, admission pressure, and boarding
            interact in a simplified emergency-department flow model.
          </p>
          <p className="hero-support">
            Adjust a synthetic scenario, run repeated simulations, and compare operational
            tradeoffs—without using patient data.
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
