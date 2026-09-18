import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VisualizerApp } from '../visualizer/VisualizerApp';

describe('Visualizer workspace', () => {
  it('presents transparent model boundaries and five-level ESI encoding', () => {
    render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    expect(screen.getByText(/Staffing and cost are deliberately omitted/u)).not.toBeVisible();
    expect(screen.getByText('Inpatient destinations')).toBeInTheDocument();
    expect(screen.getAllByText('ESI 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ESI 5').length).toBeGreaterThan(0);
    expect(screen.getByText(/Run the simulation to choose/u)).toBeVisible();
  });

  it('creates an editable intervention from the baseline', async () => {
    const user = userEvent.setup();
    render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copy A into intervention B' }));
    expect(screen.getByRole('button', { name: 'Run Scenario B' })).toBeVisible();
    const rooms = screen.getByLabelText('Main treatment rooms, numeric value');
    await user.clear(rooms);
    await user.type(rooms, '22');
    expect(rooms).toHaveValue(22);
  });

  it('offers a persistent reduced-motion control', async () => {
    const user = userEvent.setup();
    const { container } = render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Motion'), 'reduced');
    expect(container.querySelector('.visualizer-reduced-motion')).toBeInTheDocument();
  });
});
