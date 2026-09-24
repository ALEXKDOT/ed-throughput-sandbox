import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { MetricCard } from '../features/results/MetricCard';

describe('application shell', () => {
  it('renders the complete synthetic-model orientation and controls', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'ED Throughput Sandbox' })).toBeVisible();
    expect(screen.getByText('Synthetic model')).toBeVisible();
    expect(screen.getByText('No patient data')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Run Scenario A' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mean arrivals, numeric value')).toHaveValue(6);
  });

  it('opens methodology with keyboard-operable source navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Methodology' }));
    expect(screen.getByRole('dialog', { name: 'Methodology' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sources' }));
    expect(screen.getByText(/Asplin BR/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close methodology' }));
    expect(screen.queryByRole('dialog', { name: 'Methodology' })).not.toBeInTheDocument();
  });

  it('does not allow an active scenario name to become blank', async () => {
    const user = userEvent.setup();
    render(<App />);
    const name = screen.getByLabelText('Active scenario name');
    await user.clear(name);
    expect(name).toHaveValue('Balanced baseline');
  });

  it('opens the separate Visualizer workspace without replacing the Sandbox', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Visualizer' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Emergency department flow visualizer',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run Scenario A' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Copy A into intervention B' }));
    const rooms = screen.getByLabelText('Main treatment rooms, numeric value');
    await user.clear(rooms);
    await user.type(rooms, '22');
    await user.click(screen.getByRole('button', { name: 'Sandbox' }));
    expect(screen.getByRole('heading', { level: 1, name: 'ED Throughput Sandbox' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open Visualizer' }));
    expect(screen.getByRole('button', { name: 'Run Scenario B' })).toBeVisible();
    expect(screen.getByLabelText('Main treatment rooms, numeric value')).toHaveValue(22);
    expect(screen.getByRole('link', { name: 'Skip to visualizer' })).toHaveAttribute(
      'href',
      '#visualizer-main',
    );
  });

  it('explains an unavailable metric instead of rendering a broken interval', () => {
    render(<MetricCard metric="medianLos" value={{ median: null, low: null, high: null, n: 0 }} />);
    expect(screen.getByText('N/A')).toBeVisible();
    expect(screen.getByText('No eligible observations in this run.')).toBeVisible();
    expect(screen.getByText('0 valid replications')).toBeVisible();
    expect(screen.queryByText('N/A–N/A')).not.toBeInTheDocument();
  });
});
