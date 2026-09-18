import type { LocationDefinitionV2, LocationKind, PatientSnapshotV2 } from '../simulation/v2/types';

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapGlyphPoint {
  x: number;
  y: number;
  radius: number;
}

export interface ZoneEntityLayout {
  resourceBounds: MapBounds;
  patientBounds: MapBounds;
  resources: MapGlyphPoint[];
  patients: MapGlyphPoint[];
}

export function zoneGeometry(location: LocationDefinitionV2): MapBounds {
  return {
    x: location.map.x * 10,
    y: location.map.y * 6.2,
    width: location.map.width * 10,
    height: location.map.height * 6.2,
  };
}

/**
 * The map groups operational queues without changing the patient's modeled
 * physical location. This keeps the whole waiting and boarding census visible
 * while the inspector retains the resource-level truth.
 */
export function displayLocationForPatient(patient: PatientSnapshotV2): LocationKind {
  if (patient.statuses.includes('admittedAwaitingBed')) return 'boarding';
  if (
    patient.statuses.includes('awaitingTriage') ||
    patient.statuses.includes('awaitingRoom') ||
    patient.locationId === 'overflowWaiting'
  ) {
    return 'waiting';
  }
  return patient.locationId;
}

function gridPoints(bounds: MapBounds, count: number, maximumRadius: number): MapGlyphPoint[] {
  if (count <= 0 || bounds.width <= 0 || bounds.height <= 0) return [];

  let bestColumns = 1;
  let bestCellSize = -Infinity;
  let bestEmptyCells = Infinity;
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cellSize = Math.min(bounds.width / columns, bounds.height / rows);
    const emptyCells = columns * rows - count;
    if (
      cellSize > bestCellSize + 1e-9 ||
      (Math.abs(cellSize - bestCellSize) <= 1e-9 && emptyCells < bestEmptyCells)
    ) {
      bestColumns = columns;
      bestCellSize = cellSize;
      bestEmptyCells = emptyCells;
    }
  }

  const rows = Math.ceil(count / bestColumns);
  const cellWidth = bounds.width / bestColumns;
  const cellHeight = bounds.height / rows;
  const radius = Math.min(maximumRadius, Math.max(0.08, Math.min(cellWidth, cellHeight) * 0.36));

  return Array.from({ length: count }, (_, index) => ({
    x: bounds.x + ((index % bestColumns) + 0.5) * cellWidth,
    y: bounds.y + (Math.floor(index / bestColumns) + 0.5) * cellHeight,
    radius,
  }));
}

export function layoutZoneEntities(
  geometry: MapBounds,
  resourceCount: number,
  patientCount: number,
): ZoneEntityLayout {
  const horizontalInset = Math.min(9, geometry.width * 0.08);
  const headerHeight = Math.min(34, geometry.height * 0.42);
  const footerHeight = Math.min(16, geometry.height * 0.2);
  const content: MapBounds = {
    x: geometry.x + horizontalInset,
    y: geometry.y + headerHeight,
    width: Math.max(0.5, geometry.width - horizontalInset * 2),
    height: Math.max(0.5, geometry.height - headerHeight - footerHeight),
  };

  let resourceHeight = 0;
  let gap = 0;
  if (resourceCount > 0) {
    if (patientCount === 0) {
      resourceHeight = content.height;
    } else {
      const preferredColumns = Math.max(1, Math.floor(content.width / 18));
      const preferredRows = Math.ceil(resourceCount / preferredColumns);
      const desiredHeight = Math.max(9, preferredRows * 18);
      resourceHeight = Math.min(desiredHeight, content.height * 0.42);
      gap = Math.min(6, content.height * 0.08);
    }
  }

  const resourceBounds: MapBounds = {
    ...content,
    height: resourceHeight,
  };
  const patientBounds: MapBounds = {
    x: content.x,
    y: content.y + resourceHeight + gap,
    width: content.width,
    height: Math.max(0, content.height - resourceHeight - gap),
  };

  return {
    resourceBounds,
    patientBounds,
    resources: gridPoints(resourceBounds, resourceCount, 5.5),
    patients: gridPoints(patientBounds, patientCount, 4.5),
  };
}
